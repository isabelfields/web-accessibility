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

  const totalPages = sites.reduce((sum: number, s: any) =>
    sum + (Array.isArray(s.pages) ? s.pages.length : 0), 0)

  const totalErrors = sites.reduce((sum: number, s: any) =>
    sum + (s.latestScan?.raw_violation_count ?? 0), 0)

  const errorsResolved = sites.reduce((sum: number, s: any) => {
    const latest = s.latestScan?.raw_violation_count ?? 0
    const prev = s.prevScan?.raw_violation_count ?? latest
    return sum + Math.max(0, prev - latest)
  }, 0)

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

  const criticalSiteCount = sites.filter((s: any) => {
    const patterns = (s.latestScan?.patterns ?? []) as any[]
    return patterns.some((p: any) => p.impact === 'critical')
  }).length

  return {
    sites,
    scans,
    activeDivisions,
    stats: { totalPages, totalErrors, errorsResolved, siteCount: sites.length },
    severityCounts,
    topViolations,
    scoreTrends,
    criticalSiteCount,
  }
}

function formatDate(d: string | Date | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ division?: string }>
}) {
  const [{ division }, session] = await Promise.all([searchParams, getServerSession(authOptions)])
  const isAdmin = (session?.user as any)?.role === 'admin'
  const allowedDivisions = isAdmin ? [] : ((session?.user as any)?.allowedDivisions ?? [])

  const effectiveDivision = (!isAdmin && allowedDivisions.length > 0 && division && !allowedDivisions.includes(division))
    ? allowedDivisions[0]
    : division

  const { sites, scans, activeDivisions, stats, severityCounts, topViolations, scoreTrends, criticalSiteCount } =
    await getData(effectiveDivision, allowedDivisions)

  const visibleDivisions = isAdmin
    ? activeDivisions
    : activeDivisions.filter(d => allowedDivisions.includes(d))

  const showDivisionCol = !effectiveDivision

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg-base)' }}>
      {/* Top bar */}
      <div
        className="px-8 py-4 flex items-center justify-between sticky top-0 z-10 backdrop-blur-sm"
        style={{ background: 'rgba(255,255,255,0.92)', borderBottom: '1px solid var(--color-border)' }}
      >
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Dashboard</h1>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {effectiveDivision ? `${effectiveDivision} division` : 'All Hearst properties'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && visibleDivisions.length > 0 && (
            <Suspense><DivisionFilter activeDivisions={visibleDivisions} /></Suspense>
          )}
          {!isAdmin && allowedDivisions.length > 1 && visibleDivisions.length > 0 && (
            <Suspense><DivisionFilter activeDivisions={visibleDivisions} /></Suspense>
          )}
        </div>
      </div>

      <div className="px-8 py-7">

        {/* T1 Critical Banner */}
        {criticalSiteCount > 0 && (
          <div
            className="flex items-center justify-between gap-4 rounded-lg px-5 py-3.5 mb-6"
            style={{ background: 'rgba(200,0,42,0.06)', border: '1px solid rgba(200,0,42,0.22)' }}
            role="alert"
          >
            <div className="flex items-center gap-3">
              <svg className="w-4 h-4 shrink-0" style={{ color: 'var(--color-tier1)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.962-.833-2.732 0L3.07 16.5C2.3 17.333 3.262 19 4.802 19z" />
              </svg>
              <span className="text-[13px] font-semibold" style={{ color: 'var(--color-tier1)' }}>
                {criticalSiteCount} site{criticalSiteCount !== 1 ? 's have' : ' has'} Tier 1 Critical errors requiring immediate attention
              </span>
            </div>
            <Link href="/sites" className="text-[13px] font-semibold shrink-0 hover:underline" style={{ color: 'var(--color-tier1)' }}>
              View sites →
            </Link>
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
          <div className="card p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.07em] mb-4" style={{ color: 'var(--color-text-muted)' }}>Sites</div>
            <div className="text-[48px] font-bold leading-none tabular-nums" style={{ color: 'var(--color-text-primary)' }}>{stats.siteCount}</div>
            <div className="text-[13px] font-medium mt-3" style={{ color: 'var(--color-text-secondary)' }}>{stats.totalPages} pages monitored</div>
          </div>

          <div className="card p-6" style={{ borderLeft: '4px solid var(--color-tier1)' }}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.07em] mb-4" style={{ color: 'var(--color-text-muted)' }}>Tier 1 Critical</div>
            <div className="text-[48px] font-bold leading-none tabular-nums" style={{ color: 'var(--color-tier1)' }}>{severityCounts.critical}</div>
            <div className="text-[13px] font-medium mt-3" style={{ color: 'var(--color-text-secondary)' }}>across all sites</div>
          </div>

          <div className="card p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.07em] mb-4" style={{ color: 'var(--color-text-muted)' }}>WCAG Errors</div>
            <div className="text-[48px] font-bold leading-none tabular-nums" style={{ color: 'var(--color-text-primary)' }}>{stats.totalErrors}</div>
            <div className="text-[13px] font-medium mt-3" style={{ color: 'var(--color-text-secondary)' }}>latest scans</div>
          </div>

          <div className="card p-6" style={stats.errorsResolved > 0 ? { borderLeft: '4px solid var(--color-tier4)' } : undefined}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.07em] mb-4" style={{ color: 'var(--color-text-muted)' }}>Resolved</div>
            <div
              className="text-[48px] font-bold leading-none tabular-nums"
              style={{ color: stats.errorsResolved > 0 ? 'var(--color-tier4)' : 'var(--color-text-muted)' }}
            >
              {stats.errorsResolved}
            </div>
            <div className="text-[13px] font-medium mt-3" style={{ color: 'var(--color-text-secondary)' }}>vs previous scan</div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-7">
          <div className="lg:col-span-2 card p-6">
            <h2 className="text-[13px] font-bold mb-5" style={{ color: 'var(--color-text-primary)' }}>Issue Trend Over Time</h2>
            <ScoreTrendChart trends={scoreTrends} />
          </div>
          <div className="card p-6">
            <h2 className="text-[13px] font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>Issues by Tier</h2>
            <SeverityDonut counts={severityCounts} />
          </div>
          <div className="lg:col-span-3 card p-6">
            <h2 className="text-[13px] font-bold mb-5" style={{ color: 'var(--color-text-primary)' }}>Top WCAG Errors Across All Sites</h2>
            <TopViolationsChart violations={topViolations} />
          </div>
        </div>

        {/* Sites */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[13px] font-bold" style={{ color: 'var(--color-text-primary)' }}>Sites</h2>
          <Link href="/sites" className="text-[13px] font-semibold hover:underline" style={{ color: 'var(--color-hearst-blue)' }}>
            View all →
          </Link>
        </div>
        {sites.length === 0 ? (
          <div
            className="rounded-lg p-12 text-center text-[13px]"
            style={{ border: '1px dashed var(--color-border-strong)', color: 'var(--color-text-muted)' }}
          >
            {effectiveDivision ? `No sites in ${effectiveDivision} yet.` : 'No sites yet.'}{' '}
            <a href="/sites" className="underline" style={{ color: 'var(--color-hearst-blue)' }}>Add a site</a>.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-7">
            {sites.map((site: any) => (
              <SiteCard key={site.id} site={site} />
            ))}
          </div>
        )}

        {/* Recent Scans */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[13px] font-bold" style={{ color: 'var(--color-text-primary)' }}>Recent Scans</h2>
          <span className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>Last 5</span>
        </div>
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Site</th>
                {showDivisionCol && <th scope="col">Division</th>}
                <th scope="col">Status</th>
                <th scope="col" style={{ textAlign: 'right' }}>Pages</th>
                <th scope="col" style={{ textAlign: 'right' }}>WCAG Errors</th>
                <th scope="col" style={{ textAlign: 'right' }}>Started</th>
                <th scope="col" className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {scans.length === 0 ? (
                <tr>
                  <td colSpan={showDivisionCol ? 7 : 6} className="text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
                    No scans yet.
                  </td>
                </tr>
              ) : (
                scans.map((scan: any) => (
                  <tr key={scan.id} className="group cursor-pointer relative">
                    <td>
                      <Link href={`/scans/${scan.id}`} className="absolute inset-0" aria-label={`View scan for ${scan.site_name ?? scan.root_url}`} />
                      <div className="font-semibold text-[13px]" style={{ color: 'var(--color-text-primary)' }}>{scan.site_name ?? scan.root_url}</div>
                      {scan.site_name && (
                        <div className="text-[12px] truncate max-w-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{scan.root_url}</div>
                      )}
                    </td>
                    {showDivisionCol && (
                      <td>
                        {scan.division ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[12px] font-medium"
                            style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)' }}>
                            {scan.division}
                          </span>
                        ) : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                      </td>
                    )}
                    <td><ScanStatusBadge status={scan.status} /></td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="mono font-medium text-[13px]" style={{ color: 'var(--color-text-primary)' }}>{scan.pages_scanned ?? 0}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="mono font-semibold text-[13px]" style={{ color: 'var(--color-text-primary)' }}>{scan.raw_violation_count ?? '—'}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>{formatDate(scan.started_at)}</span>
                    </td>
                    <td style={{ textAlign: 'right', position: 'relative', zIndex: 10 }} className="opacity-0 group-hover:opacity-100 transition-opacity">
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

function ScanStatusBadge({ status }: { status: string }) {
  const s: Record<string, { bg: string; color: string }> = {
    complete: { bg: 'rgba(58,125,68,0.10)',  color: '#3A7D44' },
    running:  { bg: 'rgba(0,87,184,0.10)',   color: '#0057B8' },
    failed:   { bg: 'rgba(200,0,42,0.10)',   color: '#C8002A' },
    queued:   { bg: 'rgba(176,132,0,0.10)',  color: '#B08400' },
  }
  const style = s[status] ?? { bg: 'var(--color-bg-elevated)', color: 'var(--color-text-muted)' }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-semibold"
      style={{ background: style.bg, color: style.color }}>
      {status}
    </span>
  )
}
