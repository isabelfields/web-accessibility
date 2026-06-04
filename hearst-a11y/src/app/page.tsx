import { sql } from '@/lib/db'
import Link from 'next/link'
import { Suspense } from 'react'
import { SiteCard } from '@/components/SiteCard'
import { DeleteScanButton } from '@/components/DeleteScanButton'
import { DivisionFilter } from '@/components/DivisionFilter'
import { SeverityDonut } from '@/components/SeverityDonut'
import { ScoreTrendChart } from '@/components/ScoreTrendChart'
import { TopViolationsChart } from '@/components/TopViolationsChart'

export const dynamic = 'force-dynamic'

async function getData(division?: string) {
  const [allSites, recentScans] = await Promise.all([
    sql`SELECT * FROM sites ORDER BY created_at DESC`.then(async (sites) => {
      return Promise.all(
        sites.map(async (site) => {
          const [latest] = await sql`
            SELECT status, started_at, unique_pattern_count, raw_violation_count, patterns
            FROM scan_jobs
            WHERE site_id = ${site.id} AND status = 'complete'
            ORDER BY started_at DESC LIMIT 1
          `
          const [prev] = await sql`
            SELECT raw_violation_count FROM scan_jobs
            WHERE site_id = ${site.id} AND status = 'complete'
            ORDER BY started_at DESC LIMIT 1 OFFSET 1
          `
          return { ...site, latestScan: latest ?? null, prevScan: prev ?? null }
        })
      )
    }),
    sql`
      SELECT sj.id, sj.root_url, s.name as site_name, s.division,
             sj.status, sj.score, sj.pages_scanned, sj.raw_violation_count,
             sj.started_at, sj.triggered_by
      FROM scan_jobs sj
      LEFT JOIN sites s ON s.id = sj.site_id
      ORDER BY sj.started_at DESC
      LIMIT 5
    `,
  ])

  const activeDivisions = [...new Set(
    allSites.map((s: any) => s.division).filter(Boolean)
  )] as string[]

  const sites = division
    ? allSites.filter((s: any) => s.division === division)
    : allSites

  const scans = division
    ? recentScans.filter((s: any) => s.division === division)
    : recentScans

  const filteredScores = sites
    .map((s: any) => s.latestScan?.score)
    .filter((sc: any) => sc != null) as number[]
  const avgScore = filteredScores.length
    ? Math.round(filteredScores.reduce((a, b) => a + b, 0) / filteredScores.length)
    : null

  const totalPages = sites.reduce((sum: number, s: any) =>
    sum + (Array.isArray(s.pages) ? s.pages.length : 0), 0)

  const totalErrors = sites.reduce((sum: number, s: any) =>
    sum + (s.latestScan?.raw_violation_count ?? 0), 0)

  const errorsResolved = sites.reduce((sum: number, s: any) => {
    const latest = s.latestScan?.raw_violation_count ?? 0
    const prev = s.prevScan?.raw_violation_count ?? latest
    return sum + Math.max(0, prev - latest)
  }, 0)

  // Analytics: severity counts aggregated from latest scan patterns
  const severityCounts = { critical: 0, serious: 0, moderate: 0, minor: 0 }
  const violationMap = new Map<string, { count: number; impact: string }>()

  for (const site of sites) {
    const siteId = (site as any).id
    const [latestWithPatterns] = await sql`
      SELECT patterns FROM scan_jobs
      WHERE site_id = ${siteId} AND status = 'complete'
      ORDER BY started_at DESC LIMIT 1
    `
    if (!latestWithPatterns?.patterns) continue
    for (const p of latestWithPatterns.patterns as any[]) {
      const impact = p.impact as keyof typeof severityCounts
      if (impact in severityCounts) severityCounts[impact] += p.occurrences
      const existing = violationMap.get(p.rule)
      if (existing) {
        existing.count += p.occurrences
      } else {
        violationMap.set(p.rule, { count: p.occurrences, impact: p.impact })
      }
    }
  }

  const topViolations = [...violationMap.entries()]
    .map(([rule, v]) => ({ rule, ...v }))
    .sort((a, b) => b.count - a.count)

  // Score trends: last 10 scans per site
  const scoreTrends = await Promise.all(
    sites.slice(0, 6).map(async (site: any) => {
      const rows = await sql`
        SELECT score, started_at::date::text as date
        FROM scan_jobs
        WHERE site_id = ${site.id} AND status = 'complete'
        ORDER BY started_at DESC LIMIT 10
      `
      return {
        name: site.name,
        scores: rows.reverse().map((r: any) => ({ date: r.date, score: Math.round(r.score) })),
      }
    })
  )

  return {
    sites,
    scans,
    activeDivisions,
    stats: { avgScore, totalPages, totalErrors, errorsResolved, siteCount: sites.length },
    severityCounts,
    topViolations,
    scoreTrends,
  }
}

function formatDate(d: string | Date | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function scoreColor(score: number) {
  if (score >= 90) return 'text-green-600'
  if (score >= 80) return 'text-lime-600'
  if (score >= 70) return 'text-yellow-600'
  if (score >= 60) return 'text-orange-500'
  return 'text-red-500'
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ division?: string }>
}) {
  const { division } = await searchParams
  const { sites, scans, activeDivisions, stats, severityCounts, topViolations, scoreTrends } = await getData(division)
  const showDivisionCol = !division

  return (
    <div className="min-h-screen bg-[#0c0c10]">
      {/* Top bar */}
      <div className="border-b border-[#1c1c24] px-8 py-4 flex items-center justify-between sticky top-0 z-10 bg-[#0c0c10]/90 backdrop-blur-sm">
        <div>
          <h1 className="text-base font-semibold text-white tracking-tight">Dashboard</h1>
          <p className="text-xs text-white/70 mt-0.5">{division ? `${division} division` : 'All Hearst properties'}</p>
        </div>
        {activeDivisions.length > 0 && (
          <Suspense>
            <DivisionFilter activeDivisions={activeDivisions} />
          </Suspense>
        )}
      </div>

      <div className="px-8 py-6">
        {/* Stat cards — clean, no decorations */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="bg-[#11111a] rounded-lg border border-[#1e1e2a] p-5">
            <div className="text-[11px] font-medium text-white/70 uppercase tracking-widest mb-3">Sites</div>
            <div className="text-4xl font-bold text-white tabular-nums leading-none">{stats.siteCount}</div>
            <div className="text-xs text-white/70 mt-2">{stats.totalPages} pages monitored</div>
          </div>
          <div className="bg-[#11111a] rounded-lg border border-[#1e1e2a] p-5">
            <div className="text-[11px] font-medium text-white/70 uppercase tracking-widest mb-3">Tier 1 Critical</div>
            <div className="text-4xl font-bold text-red-400 tabular-nums leading-none">{severityCounts.critical}</div>
            <div className="text-xs text-white/70 mt-2">across all sites</div>
          </div>
          <div className="bg-[#11111a] rounded-lg border border-[#1e1e2a] p-5">
            <div className="text-[11px] font-medium text-white/70 uppercase tracking-widest mb-3">WCAG Errors</div>
            <div className="text-4xl font-bold text-white tabular-nums leading-none">{stats.totalErrors}</div>
            <div className="text-xs text-white/70 mt-2">latest scans</div>
          </div>
          <div className="bg-[#11111a] rounded-lg border border-[#1e1e2a] p-5">
            <div className="text-[11px] font-medium text-white/70 uppercase tracking-widest mb-3">Resolved</div>
            <div className={`text-4xl font-bold tabular-nums leading-none ${stats.errorsResolved > 0 ? 'text-emerald-400' : 'text-white/70'}`}>{stats.errorsResolved}</div>
            <div className="text-xs text-white/70 mt-2">vs previous scan</div>
          </div>
        </div>

        {/* Analytics charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6">
          <div className="lg:col-span-2 bg-[#11111a] rounded-lg border border-[#1e1e2a] p-5">
            <h2 className="text-[11px] font-medium text-white/70 uppercase tracking-widest mb-4">Issue Trend Over Time</h2>
            <ScoreTrendChart trends={scoreTrends} />
          </div>
          <div className="bg-[#11111a] rounded-lg border border-[#1e1e2a] p-5">
            <h2 className="text-[11px] font-medium text-white/70 uppercase tracking-widest mb-2">Issues by Tier</h2>
            <SeverityDonut counts={severityCounts} />
          </div>
          <div className="lg:col-span-3 bg-[#11111a] rounded-lg border border-[#1e1e2a] p-5">
            <h2 className="text-[11px] font-medium text-white/70 uppercase tracking-widest mb-4">Top WCAG Errors Across All Sites</h2>
            <TopViolationsChart violations={topViolations} />
          </div>
        </div>

        {/* Site cards */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-medium text-white/70 uppercase tracking-widest">Sites</h2>
          <Link href="/sites" className="text-xs text-[#5b9bd6] hover:text-white font-medium transition-colors">View all →</Link>
        </div>
        {sites.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#1e1e2a] p-12 text-center text-white/70">
            {division ? `No sites in ${division} yet.` : 'No sites yet.'}{' '}
            <a href="/sites" className="text-[#5b9bd6] underline">Add a site</a>.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-6">
            {sites.map((site: any) => (
              <SiteCard key={site.id} site={site} />
            ))}
          </div>
        )}

      {/* Recent scans */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[11px] font-medium text-white/70 uppercase tracking-widest">Recent Scans</h2>
        <span className="text-xs text-white/70">Last 5</span>
      </div>
      <div className="bg-[#11111a] rounded-lg border border-[#1e1e2a] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e1e2a]">
              <th className="text-left px-4 py-3 text-[11px] font-medium text-white/70 uppercase tracking-wider">Site</th>
              {showDivisionCol && (
                <th className="text-left px-4 py-3 text-[11px] font-medium text-white/70 uppercase tracking-wider">Division</th>
              )}
              <th className="text-left px-4 py-3 text-[11px] font-medium text-white/70 uppercase tracking-wider">Status</th>
              <th className="text-right px-4 py-3 text-[11px] font-medium text-white/70 uppercase tracking-wider">Pages</th>
              <th className="text-right px-4 py-3 text-[11px] font-medium text-white/70 uppercase tracking-wider">WCAG Errors</th>
              <th className="text-right px-4 py-3 text-[11px] font-medium text-white/70 uppercase tracking-wider">Started</th>
              <th className="px-2 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {scans.length === 0 ? (
              <tr>
                <td colSpan={showDivisionCol ? 7 : 6} className="text-center py-8 text-white/70">
                  No scans yet.
                </td>
              </tr>
            ) : (
              scans.map((scan: any) => (
                <tr key={scan.id} className="border-t border-[#1a1a22] hover:bg-[#14141c] transition-colors group cursor-pointer relative">
                  <td className="px-4 py-3">
                    <Link href={`/scans/${scan.id}`} className="absolute inset-0" aria-label={`View scan for ${scan.site_name ?? scan.root_url}`} />
                    <div className="font-medium text-white text-sm">{scan.site_name ?? scan.root_url}</div>
                    {scan.site_name && <div className="text-xs text-white/70 truncate max-w-xs mt-0.5">{scan.root_url}</div>}
                  </td>
                  {showDivisionCol && (
                    <td className="px-4 py-3 text-xs">
                      {scan.division
                        ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#1e1e2a] text-white/80">{scan.division}</span>
                        : <span className="text-white/70">—</span>
                      }
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      scan.status === 'complete' ? 'bg-emerald-500/10 text-emerald-400' :
                      scan.status === 'running' ? 'bg-blue-500/10 text-blue-400' :
                      scan.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                      'bg-[#1e1e2a] text-white/80'
                    }`}>
                      {scan.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-white tabular-nums">{scan.pages_scanned ?? 0}</td>
                  <td className="px-4 py-3 text-right text-white tabular-nums">{scan.raw_violation_count ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-white/70 text-xs tabular-nums">{formatDate(scan.started_at)}</td>
                  <td className="px-2 py-3 text-right relative z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DeleteScanButton jobId={scan.id} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  )
}
