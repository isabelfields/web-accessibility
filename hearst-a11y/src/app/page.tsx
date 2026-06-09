import { sql } from '@/lib/db'
import Link from 'next/link'
import { Suspense } from 'react'
import { SiteCard } from '@/components/SiteCard'
import { DeleteScanButton } from '@/components/DeleteScanButton'
import { DivisionFilter } from '@/components/DivisionFilter'
import { SeverityDonut } from '@/components/SeverityDonut'
import { ScoreTrendChart } from '@/components/ScoreTrendChart'
import { TopViolationsChart } from '@/components/TopViolationsChart'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'

export const dynamic = 'force-dynamic'

async function getData(division?: string, allowedDivisions?: string[]) {
  // Non-admin users: restrict to their allowed divisions
  if (allowedDivisions && allowedDivisions.length > 0 && !division) {
    division = allowedDivisions[0]
  }
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
  const [{ division }, session] = await Promise.all([searchParams, getServerSession(authOptions)])
  const isAdmin = (session?.user as any)?.role === 'admin'
  const allowedDivisions = isAdmin ? [] : ((session?.user as any)?.allowedDivisions ?? [])

  // For non-admins, if they try to view a division outside their allowed set, ignore it
  const effectiveDivision = (!isAdmin && allowedDivisions.length > 0 && division && !allowedDivisions.includes(division))
    ? allowedDivisions[0]
    : division

  const { sites, scans, activeDivisions, stats, severityCounts, topViolations, scoreTrends } = await getData(effectiveDivision, allowedDivisions)

  // Non-admins only see their allowed divisions in the filter
  const visibleDivisions = isAdmin
    ? activeDivisions
    : activeDivisions.filter(d => allowedDivisions.includes(d))

  const showDivisionCol = !effectiveDivision

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      {/* Top bar */}
      <div className="border-b border-[var(--border)] px-8 py-5 flex items-center justify-between sticky top-0 z-10 bg-[var(--bg-header)]/95 backdrop-blur-sm">
        <div>
          <h1 className="text-xl font-bold text-[var(--text)] tracking-tight">Dashboard</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">{division ? `${division} division` : 'All Hearst properties'}</p>
        </div>
        {isAdmin && visibleDivisions.length > 0 && (
          <Suspense>
            <DivisionFilter activeDivisions={visibleDivisions} />
          </Suspense>
        )}
        {!isAdmin && allowedDivisions.length > 1 && visibleDivisions.length > 0 && (
          <Suspense>
            <DivisionFilter activeDivisions={visibleDivisions} />
          </Suspense>
        )}
      </div>

      <div className="px-8 py-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="card p-6">
            <div className="text-[11px] font-semibold text-[var(--text-subtle)] uppercase tracking-widest mb-4">Sites</div>
            <div className="text-5xl font-extrabold text-[var(--text)] tabular-nums leading-none tracking-tight">{stats.siteCount}</div>
            <div className="text-sm text-[var(--text-muted)] mt-3 font-medium">{stats.totalPages} pages monitored</div>
          </div>
          <div className="card p-6 border-l-4 border-l-red-500">
            <div className="text-[11px] font-semibold text-[var(--text-subtle)] uppercase tracking-widest mb-4">Tier 1 Critical</div>
            <div className="text-5xl font-extrabold text-red-500 tabular-nums leading-none tracking-tight">{severityCounts.critical}</div>
            <div className="text-sm text-[var(--text-muted)] mt-3 font-medium">across all sites</div>
          </div>
          <div className="card p-6">
            <div className="text-[11px] font-semibold text-[var(--text-subtle)] uppercase tracking-widest mb-4">WCAG Errors</div>
            <div className="text-5xl font-extrabold text-[var(--text)] tabular-nums leading-none tracking-tight">{stats.totalErrors}</div>
            <div className="text-sm text-[var(--text-muted)] mt-3 font-medium">latest scans</div>
          </div>
          <div className="card p-6 border-l-4 border-l-emerald-500">
            <div className="text-[11px] font-semibold text-[var(--text-subtle)] uppercase tracking-widest mb-4">Resolved</div>
            <div className={`text-5xl font-extrabold tabular-nums leading-none tracking-tight ${stats.errorsResolved > 0 ? 'text-emerald-500' : 'text-[var(--text-subtle)]'}`}>{stats.errorsResolved}</div>
            <div className="text-sm text-[var(--text-muted)] mt-3 font-medium">vs previous scan</div>
          </div>
        </div>

        {/* Analytics charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="lg:col-span-2 card p-6">
            <h2 className="text-sm font-bold text-[var(--text)] mb-5">Issue Trend Over Time</h2>
            <ScoreTrendChart trends={scoreTrends} />
          </div>
          <div className="card p-6">
            <h2 className="text-sm font-bold text-[var(--text)] mb-3">Issues by Tier</h2>
            <SeverityDonut counts={severityCounts} />
          </div>
          <div className="lg:col-span-3 card p-6">
            <h2 className="text-sm font-bold text-[var(--text)] mb-5">Top WCAG Errors Across All Sites</h2>
            <TopViolationsChart violations={topViolations} />
          </div>
        </div>

        {/* Site cards */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-[var(--text)]">Sites</h2>
          <Link href="/sites" className="text-sm text-[var(--accent)] hover:text-[var(--text)] font-semibold transition-colors">View all →</Link>
        </div>
        {sites.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--border)] p-12 text-center text-[var(--text-muted)]">
            {division ? `No sites in ${division} yet.` : 'No sites yet.'}{' '}
            <a href="/sites" className="text-[#5b9bd6] underline">Add a site</a>.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
            {sites.map((site: any) => (
              <SiteCard key={site.id} site={site} />
            ))}
          </div>
        )}

      {/* Recent scans */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-[var(--text)]">Recent Scans</h2>
        <span className="text-sm text-[var(--text-muted)]">Last 5</span>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--bg-header)] border-b border-[var(--border)]">
              <th className="text-left px-4 py-3 text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Site</th>
              {showDivisionCol && (
                <th className="text-left px-4 py-3 text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Division</th>
              )}
              <th className="text-left px-4 py-3 text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Status</th>
              <th className="text-right px-4 py-3 text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Pages</th>
              <th className="text-right px-4 py-3 text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">WCAG Errors</th>
              <th className="text-right px-4 py-3 text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Started</th>
              <th className="px-2 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {scans.length === 0 ? (
              <tr>
                <td colSpan={showDivisionCol ? 7 : 6} className="text-center py-8 text-[var(--text-muted)]">
                  No scans yet.
                </td>
              </tr>
            ) : (
              scans.map((scan: any) => (
                <tr key={scan.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-elevated)] transition-colors group cursor-pointer relative">
                  <td className="px-4 py-3">
                    <Link href={`/scans/${scan.id}`} className="absolute inset-0" aria-label={`View scan for ${scan.site_name ?? scan.root_url}`} />
                    <div className="font-medium text-[var(--text)] text-sm">{scan.site_name ?? scan.root_url}</div>
                    {scan.site_name && <div className="text-xs text-[var(--text-muted)] truncate max-w-xs mt-0.5">{scan.root_url}</div>}
                  </td>
                  {showDivisionCol && (
                    <td className="px-4 py-3 text-xs">
                      {scan.division
                        ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--bg-elevated)] text-[var(--text-muted)]">{scan.division}</span>
                        : <span className="text-[var(--text-muted)]">—</span>
                      }
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      scan.status === 'complete' ? 'bg-emerald-500/10 text-emerald-400' :
                      scan.status === 'running' ? 'bg-blue-500/10 text-blue-400' :
                      scan.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                      'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
                    }`}>
                      {scan.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-[var(--text)] tabular-nums">{scan.pages_scanned ?? 0}</td>
                  <td className="px-4 py-3 text-right text-[var(--text)] tabular-nums">{scan.raw_violation_count ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-[var(--text-muted)] text-xs tabular-nums">{formatDate(scan.started_at)}</td>
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
