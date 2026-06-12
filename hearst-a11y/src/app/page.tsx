import { sql } from '@/lib/db'
import Link from 'next/link'
import { Suspense } from 'react'
import { SiteCard } from '@/components/SiteCard'
import { DeleteScanButton } from '@/components/DeleteScanButton'
import { DivisionFilter } from '@/components/DivisionFilter'
import { ChartsSection } from '@/components/ChartsSection'
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
            SELECT status, started_at, unique_pattern_count, raw_violation_count,
                   COALESCE(patterns, '[]'::jsonb) as patterns
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
  const violationMap = new Map<string, { count: number; impact: string; affectedSites: Set<string> }>()

  for (const site of sites) {
    const patterns = (site as any).latestScan?.patterns
    if (!patterns) continue
    for (const p of patterns as any[]) {
      const impact = p.impact as keyof typeof severityCounts
      if (impact in severityCounts) severityCounts[impact] += p.occurrences
      const existing = violationMap.get(p.rule)
      if (existing) {
        existing.count += p.occurrences
        existing.affectedSites.add((site as any).id)
      } else {
        violationMap.set(p.rule, { count: p.occurrences, impact: p.impact, affectedSites: new Set([(site as any).id]) })
      }
    }
  }

  const topViolations = [...violationMap.entries()]
    .map(([rule, v]) => ({ rule, count: v.count, impact: v.impact, affectedSites: v.affectedSites.size }))
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
    const patterns = s.latestScan?.patterns ?? []
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

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  complete: { background: '#ECFDF5', color: '#059669' },
  running:  { background: '#EFF6FF', color: '#2563EB' },
  failed:   { background: '#FEF2F2', color: '#DC2626' },
  queued:   { background: '#F3F4F6', color: '#6B7280' },
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ division?: string }>
}) {
  try {
  const [{ division }, session] = await Promise.all([searchParams, getServerSession(authOptions)])
  const isAdmin = (session?.user as any)?.role === 'admin'
  const allowedDivisions = isAdmin ? [] : ((session?.user as any)?.allowedDivisions ?? [])

  const effectiveDivision = (!isAdmin && allowedDivisions.length > 0 && division && !allowedDivisions.includes(division))
    ? allowedDivisions[0]
    : division

  let dashData
  let dataError: string | null = null
  try {
    dashData = await getData(effectiveDivision, allowedDivisions)
  } catch (err: any) {
    dataError = err?.message ?? String(err)
  }

  if (dataError || !dashData) {
    return (
      <div style={{ padding: 40, fontFamily: 'monospace', fontSize: 13, color: '#DC2626', background: '#FEF2F2', minHeight: '100vh' }}>
        <strong>Dashboard error:</strong><br />{dataError}
      </div>
    )
  }

  const { sites, scans, activeDivisions, stats, severityCounts, topViolations, scoreTrends, criticalSiteCount } = dashData

  const visibleDivisions = isAdmin
    ? activeDivisions
    : activeDivisions.filter(d => allowedDivisions.includes(d))

  const showDivisionCol = !effectiveDivision

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F7' }}>

      {/* Top bar */}
      <div style={{ borderBottom: '1px solid #E5E5EA', padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10, background: 'rgba(245,245,247,0.92)', backdropFilter: 'blur(8px)' }}>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: '#1D1D1F', margin: 0, letterSpacing: '-0.01em' }}>Dashboard</h1>
          <p style={{ fontSize: 12, color: '#86868B', margin: 0 }}>{effectiveDivision ? `${effectiveDivision} division` : 'All Hearst properties'}</p>
        </div>
        {(isAdmin || allowedDivisions.length > 1) && visibleDivisions.length > 0 && (
          <Suspense>
            <DivisionFilter activeDivisions={visibleDivisions} />
          </Suspense>
        )}
      </div>

      <div style={{ padding: '24px 32px' }}>

        {/* Alert banner — T1 critical sites */}
        {criticalSiteCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#EFF6FF', border: '1px solid #BFDBFE', borderLeft: '4px solid #2563EB', borderRadius: 10, padding: '12px 20px', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#1D4ED8', fontSize: 14, fontWeight: 500 }}>
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
              <span>{criticalSiteCount} site{criticalSiteCount !== 1 ? 's' : ''} have Tier 1 Critical errors requiring immediate attention</span>
            </div>
            <Link href="/sites" style={{ color: '#1D4ED8', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>View sites →</Link>
          </div>
        )}

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>

          {/* Sites */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E5EA', padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Sites</div>
            <div style={{ fontSize: 40, fontWeight: 800, color: '#1D1D1F', lineHeight: 1, letterSpacing: '-0.02em' }}>{stats.siteCount}</div>
            <div style={{ fontSize: 12, color: '#86868B', marginTop: 8 }}>{stats.totalPages} pages monitored</div>
          </div>

          {/* Tier 1 Critical — navy left accent */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E5EA', borderLeft: '4px solid #002D82', padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Tier 1 Critical</div>
            <div style={{ fontSize: 40, fontWeight: 800, color: '#002D82', lineHeight: 1, letterSpacing: '-0.02em' }}>{severityCounts.critical}</div>
            <div style={{ fontSize: 12, color: '#86868B', marginTop: 8 }}>across all sites</div>
          </div>

          {/* WCAG Errors — blue left accent */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E5EA', borderLeft: '4px solid #007AFF', padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>WCAG Errors</div>
            <div style={{ fontSize: 40, fontWeight: 800, color: '#007AFF', lineHeight: 1, letterSpacing: '-0.02em' }}>{stats.totalErrors}</div>
            <div style={{ fontSize: 12, color: '#86868B', marginTop: 8 }}>latest scans</div>
          </div>

          {/* Resolved */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E5EA', padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Resolved</div>
            <div style={{ fontSize: 40, fontWeight: 800, color: stats.errorsResolved > 0 ? '#059669' : '#1D1D1F', lineHeight: 1, letterSpacing: '-0.02em' }}>{stats.errorsResolved}</div>
            <div style={{ fontSize: 12, color: '#86868B', marginTop: 8 }}>vs previous scan</div>
          </div>
        </div>

        {/* Charts row + Top WCAG Errors */}
        <ChartsSection severityCounts={severityCounts} topViolations={topViolations} scoreTrends={scoreTrends} />

        {/* Site cards */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Sites</div>
          <Link href="/sites" style={{ fontSize: 12, color: '#007AFF', fontWeight: 600 }}>View all →</Link>
        </div>
        {sites.length === 0 ? (
          <div style={{ borderRadius: 12, border: '1.5px dashed #D1D1D6', padding: '48px 32px', textAlign: 'center', color: '#86868B', background: '#fff', marginBottom: 20 }}>
            {effectiveDivision ? `No sites in ${effectiveDivision} yet.` : 'No sites yet.'}{' '}
            <a href="/sites" style={{ color: '#007AFF' }}>Add a site</a>.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
            {sites.map((site: any) => (
              <SiteCard key={site.id} site={site} />
            ))}
          </div>
        )}

        {/* Recent scans */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Recent Scans</div>
          <span style={{ fontSize: 12, color: '#86868B' }}>Last 5</span>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E5EA', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F9F9FB', borderBottom: '1px solid #E5E5EA' }}>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Site</th>
                {showDivisionCol && <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Division</th>}
                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</th>
                <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pages</th>
                <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>WCAG Errors</th>
                <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Started</th>
                <th style={{ padding: '10px 8px' }} />
              </tr>
            </thead>
            <tbody>
              {scans.length === 0 ? (
                <tr><td colSpan={showDivisionCol ? 7 : 6} style={{ textAlign: 'center', padding: '32px 0', color: '#86868B' }}>No scans yet.</td></tr>
              ) : (
                scans.map((scan: any) => (
                  <tr key={scan.id} style={{ borderTop: '1px solid #F0F0F0', cursor: 'pointer', position: 'relative' }}
                    className="group hover:bg-[#F5F5F7] transition-colors">
                    <td style={{ padding: '12px 16px' }}>
                      <Link href={`/scans/${scan.id}`} style={{ position: 'absolute', inset: 0 }} aria-label={`View scan for ${scan.site_name ?? scan.root_url}`} />
                      <div style={{ fontWeight: 600, color: '#1D1D1F', fontSize: 13 }}>{scan.site_name ?? scan.root_url}</div>
                      {scan.site_name && <div style={{ fontSize: 11, color: '#86868B', marginTop: 2, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{scan.root_url}</div>}
                    </td>
                    {showDivisionCol && (
                      <td style={{ padding: '12px 16px' }}>
                        {scan.division
                          ? <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#EFF6FF', color: '#1D4ED8' }}>{scan.division}</span>
                          : <span style={{ color: '#86868B' }}>—</span>}
                      </td>
                    )}
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ display: 'inline-flex', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, ...(STATUS_STYLE[scan.status] ?? STATUS_STYLE.queued) }}>
                        {scan.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: '#1D1D1F', fontVariantNumeric: 'tabular-nums' }}>{scan.pages_scanned ?? 0}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: '#1D1D1F', fontVariantNumeric: 'tabular-nums' }}>{scan.raw_violation_count ?? '—'}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: '#86868B', fontSize: 12 }}>{formatDate(scan.started_at)}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'right', position: 'relative', zIndex: 1 }}>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <DeleteScanButton jobId={scan.id} />
                      </div>
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
  } catch (err: any) {
    return (
      <div style={{ padding: 40, fontFamily: 'monospace', fontSize: 13, color: '#DC2626', background: '#FEF2F2', minHeight: '100vh', whiteSpace: 'pre-wrap' }}>
        <strong>Page render error:</strong>{'\n'}{err?.stack ?? err?.message ?? String(err)}
      </div>
    )
  }
}
