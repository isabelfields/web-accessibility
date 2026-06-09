import React, { Suspense } from 'react'
import { sql } from '@/lib/db'
import Link from 'next/link'
import { SiteCard } from '@/components/SiteCard'
import { DeleteScanButton } from '@/components/DeleteScanButton'
import { DivisionFilter } from '@/components/DivisionFilter'
import { SeverityDonut } from '@/components/SeverityDonut'
import { ScoreTrendChart } from '@/components/ScoreTrendChart'
import { TopViolationsChart } from '@/components/TopViolationsChart'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'

export const dynamic = 'force-dynamic'

const TIER_COLORS = { t1: '#002D82', t2: '#005AC8', t3: '#007AFF', t4: '#0A84CC' }

async function getData(division?: string, allowedDivisions?: string[]) {
  if (allowedDivisions && allowedDivisions.length > 0 && !division) {
    division = allowedDivisions[0]
  }
  const [allSites, recentScans] = await Promise.all([
    sql`SELECT * FROM sites ORDER BY created_at DESC`.then(async (sites) => {
      return Promise.all(sites.map(async (site) => {
        const [latest] = await sql`
          SELECT status, started_at, unique_pattern_count, raw_violation_count, patterns
          FROM scan_jobs WHERE site_id = ${site.id} AND status = 'complete'
          ORDER BY started_at DESC LIMIT 1`
        const [prev] = await sql`
          SELECT raw_violation_count FROM scan_jobs
          WHERE site_id = ${site.id} AND status = 'complete'
          ORDER BY started_at DESC LIMIT 1 OFFSET 1`
        return { ...site, latestScan: latest ?? null, prevScan: prev ?? null }
      }))
    }),
    sql`SELECT sj.id, sj.root_url, s.name as site_name, s.division,
           sj.status, sj.score, sj.pages_scanned, sj.raw_violation_count,
           sj.started_at, sj.triggered_by
        FROM scan_jobs sj LEFT JOIN sites s ON s.id = sj.site_id
        ORDER BY sj.started_at DESC LIMIT 5`,
  ])

  const activeDivisions = [...new Set(allSites.map((s: any) => s.division).filter(Boolean))] as string[]
  const sites = division ? allSites.filter((s: any) => s.division === division) : allSites
  const scans = division ? recentScans.filter((s: any) => s.division === division) : recentScans

  const totalPages = sites.reduce((sum: number, s: any) => sum + (Array.isArray(s.pages) ? s.pages.length : 0), 0)
  const errorsResolved = sites.reduce((sum: number, s: any) => {
    const latest = s.latestScan?.raw_violation_count ?? 0
    const prev = s.prevScan?.raw_violation_count ?? latest
    return sum + Math.max(0, prev - latest)
  }, 0)

  const severityCounts = { critical: 0, serious: 0, moderate: 0, minor: 0 }
  const violationMap = new Map<string, { count: number; impact: string }>()
  for (const site of sites) {
    const [row] = await sql`SELECT patterns FROM scan_jobs
      WHERE site_id = ${(site as any).id} AND status = 'complete'
      ORDER BY started_at DESC LIMIT 1`
    if (!row?.patterns) continue
    for (const p of row.patterns as any[]) {
      const impact = p.impact as keyof typeof severityCounts
      if (impact in severityCounts) severityCounts[impact] += p.occurrences
      const ex = violationMap.get(p.rule)
      ex ? (ex.count += p.occurrences) : violationMap.set(p.rule, { count: p.occurrences, impact: p.impact })
    }
  }

  const topViolations = [...violationMap.entries()]
    .map(([rule, v]) => ({ rule, ...v })).sort((a, b) => b.count - a.count)

  const scoreTrends = await Promise.all(sites.slice(0, 6).map(async (site: any) => {
    const rows = await sql`SELECT score, started_at::date::text as date FROM scan_jobs
      WHERE site_id = ${site.id} AND status = 'complete'
      ORDER BY started_at DESC LIMIT 10`
    return { name: site.name, scores: rows.reverse().map((r: any) => ({ date: r.date, score: Math.round(r.score) })) }
  }))

  const t1SiteCount = sites.filter((s: any) =>
    ((s.latestScan?.patterns ?? []) as any[]).some((p: any) => p.impact === 'critical')
  ).length

  const totalErrors = sites.reduce((sum: number, s: any) => sum + (s.latestScan?.raw_violation_count ?? 0), 0)

  return { sites, scans, activeDivisions, stats: { totalPages, totalErrors, errorsResolved, siteCount: sites.length }, severityCounts, topViolations, scoreTrends, t1SiteCount }
}

function formatDate(d: string | Date | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Shared inline style constants ──────────────────────────
const S = {
  card: {
    background: '#FFFFFF',
    borderRadius: '14px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
    padding: '22px 22px 18px',
  } as React.CSSProperties,
  sectionLabel: {
    fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em',
    textTransform: 'uppercase' as const, color: '#86868B', marginBottom: '16px',
  } as React.CSSProperties,
  pageBase: { background: '#F5F5F7', minHeight: '100vh' } as React.CSSProperties,
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ division?: string }> }) {
  const [{ division }, session] = await Promise.all([searchParams, getServerSession(authOptions)])
  const isAdmin = (session?.user as any)?.role === 'admin'
  const allowedDivisions = isAdmin ? [] : ((session?.user as any)?.allowedDivisions ?? [])
  const effectiveDivision = (!isAdmin && allowedDivisions.length > 0 && division && !allowedDivisions.includes(division))
    ? allowedDivisions[0] : division

  const { sites, scans, activeDivisions, stats, severityCounts, topViolations, scoreTrends, t1SiteCount } =
    await getData(effectiveDivision, allowedDivisions)

  const visibleDivisions = isAdmin ? activeDivisions : activeDivisions.filter(d => allowedDivisions.includes(d))
  const showDivisionCol = !effectiveDivision

  return (
    <div style={S.pageBase}>
      {/* Top bar */}
      <div style={{
        background: '#FFFFFF', borderBottom: '1px solid #F0F0F0',
        padding: '0 28px', height: '52px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div>
          <span style={{ fontSize: '15px', fontWeight: 600, color: '#1D1D1F' }}>Dashboard</span>
          <span style={{ fontSize: '12px', color: '#86868B', marginLeft: '10px' }}>
            {effectiveDivision ? `${effectiveDivision} division` : 'All Hearst properties'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isAdmin && visibleDivisions.length > 0 && <Suspense><DivisionFilter activeDivisions={visibleDivisions} /></Suspense>}
          {!isAdmin && allowedDivisions.length > 1 && visibleDivisions.length > 0 && <Suspense><DivisionFilter activeDivisions={visibleDivisions} /></Suspense>}
        </div>
      </div>

      <div style={{ padding: '22px 28px' }}>

        {/* T1 Critical Banner */}
        {t1SiteCount > 0 && (
          <div role="alert" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
            background: 'rgba(0,45,130,0.06)', border: '1px solid rgba(0,45,130,0.20)',
            borderRadius: '10px', padding: '12px 18px', marginBottom: '20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="16" height="16" fill="none" stroke="#002D82" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.962-.833-2.732 0L3.07 16.5C2.3 17.333 3.262 19 4.802 19z" />
              </svg>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#002D82' }}>
                {t1SiteCount} site{t1SiteCount !== 1 ? 's have' : ' has'} Tier 1 Critical errors requiring immediate attention
              </span>
            </div>
            <Link href="/sites" style={{ fontSize: '13px', fontWeight: 600, color: '#002D82', textDecoration: 'none', flexShrink: 0 }}>
              View sites →
            </Link>
          </div>
        )}

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '14px', marginBottom: '20px' }}>
          <StatCard label="Sites" value={stats.siteCount} sub={`${stats.totalPages} pages monitored`} />
          <StatCard label="Tier 1 Critical" value={severityCounts.critical} sub="across all sites"
            accentColor={TIER_COLORS.t1} heroSize={52} />
          <StatCard label="WCAG Errors" value={stats.totalErrors} sub="latest scans" accentColor="#007AFF" />
          <StatCard label="Resolved" value={stats.errorsResolved} sub="vs previous scan"
            accentColor={stats.errorsResolved > 0 ? '#34C759' : undefined} />
        </div>

        {/* Charts */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '14px', marginBottom: '20px' }}>
          <div style={S.card}>
            <div style={S.sectionLabel}>Issue Trend Over Time</div>
            <ScoreTrendChart trends={scoreTrends} />
          </div>
          <div style={{ ...S.card, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ ...S.sectionLabel, alignSelf: 'flex-start', width: '100%' }}>Issues by Tier</div>
            <SeverityDonut counts={severityCounts} />
          </div>
        </div>
        <div style={{ ...S.card, marginBottom: '20px' }}>
          <div style={S.sectionLabel}>Top WCAG Errors Across All Sites</div>
          <TopViolationsChart violations={topViolations} />
        </div>

        {/* Sites */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#1D1D1F' }}>Sites</span>
          <Link href="/sites" style={{ fontSize: '13px', fontWeight: 500, color: '#007AFF', textDecoration: 'none' }}>View all →</Link>
        </div>
        {sites.length === 0 ? (
          <div style={{ border: '1px dashed #C0C0C0', borderRadius: '14px', padding: '48px', textAlign: 'center', color: '#86868B', fontSize: '14px' }}>
            {effectiveDivision ? `No sites in ${effectiveDivision} yet.` : 'No sites yet.'}{' '}
            <a href="/sites" style={{ color: '#007AFF' }}>Add a site</a>.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px', marginBottom: '20px' }}>
            {sites.map((site: any) => <SiteCard key={site.id} site={site} />)}
          </div>
        )}

        {/* Recent Scans */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#1D1D1F' }}>Recent Scans</span>
          <span style={{ fontSize: '12px', color: '#86868B' }}>Last 5</span>
        </div>
        <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <caption className="sr-only">Recent accessibility scans</caption>
            <thead>
              <tr>
                <th scope="col">Site</th>
                {showDivisionCol && <th scope="col">Division</th>}
                <th scope="col">Status</th>
                <th scope="col" style={{ textAlign: 'right' }}>Pages</th>
                <th scope="col" style={{ textAlign: 'right' }}>WCAG Errors</th>
                <th scope="col" style={{ textAlign: 'right' }}>Started</th>
                <th scope="col" style={{ width: '32px' }}></th>
              </tr>
            </thead>
            <tbody>
              {scans.length === 0 ? (
                <tr><td colSpan={showDivisionCol ? 7 : 6} style={{ textAlign: 'center', padding: '40px', color: '#86868B' }}>No scans yet.</td></tr>
              ) : scans.map((scan: any) => (
                <tr key={scan.id} className="clickable group relative">
                  <td>
                    <Link href={`/scans/${scan.id}`} className="absolute inset-0" aria-label={`View scan for ${scan.site_name ?? scan.root_url}`} />
                    <div style={{ fontWeight: 500, fontSize: '13px', color: '#1D1D1F' }}>{scan.site_name ?? scan.root_url}</div>
                    {scan.site_name && <div className="mono" style={{ fontSize: '11px', color: '#86868B', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '260px' }}>{scan.root_url}</div>}
                  </td>
                  {showDivisionCol && (
                    <td>
                      {scan.division
                        ? <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '6px', background: '#F5F5F7', color: '#3A3A3C' }}>{scan.division}</span>
                        : <span style={{ color: '#86868B' }}>—</span>}
                    </td>
                  )}
                  <td><ScanStatusBadge status={scan.status} /></td>
                  <td style={{ textAlign: 'right' }}><span className="mono" style={{ fontWeight: 500, fontSize: '13px' }}>{scan.pages_scanned ?? 0}</span></td>
                  <td style={{ textAlign: 'right' }}><span className="mono" style={{ fontWeight: 600, fontSize: '13px' }}>{scan.raw_violation_count ?? '—'}</span></td>
                  <td style={{ textAlign: 'right' }}><span style={{ fontSize: '12px', color: '#86868B' }}>{formatDate(scan.started_at)}</span></td>
                  <td style={{ textAlign: 'right', position: 'relative', zIndex: 10 }} className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <DeleteScanButton jobId={scan.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  )
}

function StatCard({ label, value, sub, accentColor, heroSize = 44 }: {
  label: string; value: number; sub: string; accentColor?: string; heroSize?: number
}) {
  return (
    <div style={{
      background: '#FFFFFF', borderRadius: '14px',
      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
      padding: '22px 22px 18px',
      borderLeft: accentColor ? `3px solid ${accentColor}` : undefined,
    }}>
      <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#86868B' }}>
        {label}
      </div>
      <div style={{ fontSize: `${heroSize}px`, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: accentColor ?? '#1D1D1F', margin: '10px 0 6px', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      <div style={{ fontSize: '12px', color: '#86868B' }}>{sub}</div>
    </div>
  )
}

function ScanStatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    complete: { bg: 'rgba(52,199,89,0.10)',  color: '#1A7F37' },
    running:  { bg: 'rgba(0,122,255,0.10)',  color: '#005AC8' },
    failed:   { bg: 'rgba(0,45,130,0.10)',   color: '#002D82' },
    queued:   { bg: 'rgba(0,90,200,0.10)',   color: '#005AC8' },
  }
  const s = map[status] ?? { bg: '#F5F5F7', color: '#86868B' }
  return (
    <span style={{ ...s, fontSize: '12px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px', display: 'inline-flex', alignItems: 'center' }}>
      {status}
    </span>
  )
}
