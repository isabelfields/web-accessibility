import { sql } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { RunScanButton } from '@/components/RunScanButton'
import { CancelScanButton } from '@/components/CancelScanButton'
import { DeleteScanButton } from '@/components/DeleteScanButton'
import { TierSection } from '@/components/TierSection'
import { SiteTrendChart } from '@/components/SiteTrendChart'
import { EditSiteButton } from '@/components/EditSiteButton'
import { PageViolationsModal } from '@/components/PageViolationsModal'
import { patternsToWorstTier, TIER_LABEL, impactToTier } from '@/lib/tiers'
import type { ViolationPattern, SitePage } from '@/types'

export const dynamic = 'force-dynamic'

const TIER_SWIMLANE: Record<string, string> = {
  tier1: '#002D82',
  tier2: '#005AC8',
  tier3: '#007AFF',
  tier4: '#5AC8FA',
}

const TIER_JUMP_LABEL: Record<string, string> = {
  tier1: 'T1', tier2: 'T2', tier3: 'T3', tier4: 'T4',
}

async function getSiteData(id: string) {
  const [site] = await sql`SELECT * FROM sites WHERE id = ${id}`
  if (!site) return null

  const scans = await sql`
    SELECT id, status, pages_scanned, raw_violation_count,
           unique_pattern_count, estimated_cost_usd, started_at, completed_at,
           triggered_by, patterns, page_scores
    FROM scan_jobs
    WHERE site_id = ${id}
    ORDER BY started_at DESC
    LIMIT 20
  `

  return { site, scans }
}

function formatDate(d: string | Date | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  complete: { background: '#ECFDF5', color: '#059669' },
  running:  { background: '#EFF6FF', color: '#2563EB' },
  failed:   { background: '#FEF2F2', color: '#DC2626' },
  queued:   { background: '#F3F4F6', color: '#6B6B6B' },
}

export default async function SiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await getSiteData(id)
  if (!data) notFound()

  const { site, scans } = data
  const pages: SitePage[] = (site.pages as SitePage[]) ?? []

  const completedScans = scans.filter((s: any) => s.status === 'complete')
  const latestScan = completedScans[0] ?? null
  const prevScan = completedScans[1] ?? null
  const pageScores: Array<{ url: string; label?: string; score: number | null; violationCount: number | null; error?: string }> =
    latestScan?.page_scores ?? []

  const patterns: ViolationPattern[] = latestScan?.patterns ?? []
  const byTier: Record<string, ViolationPattern[]> = { tier1: [], tier2: [], tier3: [], tier4: [] }
  for (const p of patterns) {
    byTier[impactToTier(p.impact)].push(p)
  }
  const worstTier = patternsToWorstTier(patterns)

  // WCAG error trend vs previous scan
  const currentErrors = latestScan?.raw_violation_count ?? null
  const prevErrors = prevScan?.raw_violation_count ?? null
  const errorDelta = (currentErrors !== null && prevErrors !== null) ? currentErrors - prevErrors : null

  // Tiers present (for jump nav)
  const presentTiers = (['tier1', 'tier2', 'tier3', 'tier4'] as const).filter(t => byTier[t].length > 0)

  // Trend data for chart (oldest → newest)
  const trendPoints = completedScans
    .slice(0, 10)
    .reverse()
    .map((s: any) => ({
      date: new Date(s.started_at).toISOString().split('T')[0],
      count: s.raw_violation_count ?? 0,
    }))

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F7', padding: '24px 32px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginBottom: 8 }}>
            <Link href="/sites" style={{ color: '#007AFF', fontWeight: 500 }}>Sites</Link>
            <span style={{ color: '#6B6B6B' }}>/</span>
            <span style={{ color: '#6B6B6B' }}>{site.name}</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1D1D1F', margin: 0, letterSpacing: '-0.02em' }}>{site.name}</h1>
          {latestScan && (
            <p style={{ fontSize: 13, color: '#6B6B6B', marginTop: 4 }}>
              Last scanned {formatDate(latestScan.started_at)}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
          <EditSiteButton site={{ id: site.id, name: site.name, division: site.division, pages }} />
          <RunScanButton siteId={site.id} />
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>

        {/* Priority — navy left accent */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E5EA', borderLeft: '4px solid #002D82', padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Priority</div>
          {worstTier ? (
            <>
              <div style={{ fontSize: 28, fontWeight: 800, color: TIER_SWIMLANE[worstTier], letterSpacing: '-0.02em', lineHeight: 1 }}>
                {TIER_LABEL[worstTier]}
              </div>
              <div style={{ fontSize: 12, color: '#6B6B6B', marginTop: 8 }}>highest tier found</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#059669', lineHeight: 1 }}>{latestScan ? 'No issues' : 'No scans'}</div>
              <div style={{ fontSize: 12, color: '#6B6B6B', marginTop: 8 }}>{latestScan ? 'All clear' : 'Run a scan'}</div>
            </>
          )}
        </div>

        {/* WCAG Errors with trend badge */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E5EA', padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>WCAG Errors</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.02em', lineHeight: 1 }}>{currentErrors ?? '—'}</div>
            {errorDelta !== null && errorDelta !== 0 && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 8px',
                borderRadius: 20, fontSize: 11, fontWeight: 700,
                background: errorDelta > 0 ? '#FEF2F2' : '#ECFDF5',
                color: errorDelta > 0 ? '#DC2626' : '#059669',
              }}>
                {errorDelta > 0 ? '↑' : '↓'} {Math.abs(errorDelta)}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#6B6B6B', marginTop: 8 }}>vs previous scan</div>
        </div>

        {/* Pages Scanned */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E5EA', padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Pages Scanned</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.02em', lineHeight: 1 }}>{latestScan?.pages_scanned ?? '—'}</div>
          <div style={{ fontSize: 12, color: '#6B6B6B', marginTop: 8 }}>{pages.length} configured</div>
        </div>

        {/* Total Scans */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E5EA', padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Total Scans</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.02em', lineHeight: 1 }}>{scans.length}</div>
          <div style={{ fontSize: 12, color: '#6B6B6B', marginTop: 8 }}>{completedScans.length} completed</div>
        </div>
      </div>

      {/* Issue trend chart */}
      {trendPoints.length >= 2 && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E5EA', padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Issue Count Over Time</div>
          <div style={{ fontSize: 11, color: '#6B6B6B', marginBottom: 12 }}>Failing elements across scans</div>
          <SiteTrendChart points={trendPoints} />
        </div>
      )}

      {/* WCAG Errors — swimlane layout */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1D1D1F', margin: 0 }}>WCAG Errors</h2>
          {presentTiers.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#6B6B6B', marginRight: 4 }}>Jump to</span>
              {presentTiers.map(tier => (
                <a key={tier} href={`#${tier}`} style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 32, height: 32, borderRadius: '50%',
                  background: '#E5E5EA', color: '#3A3A3C',
                  fontSize: 11, fontWeight: 700, textDecoration: 'none',
                }}>
                  {TIER_JUMP_LABEL[tier]}
                </a>
              ))}
            </div>
          )}
        </div>

        {patterns.length === 0 ? (
          <div style={{ borderRadius: 12, border: '1.5px dashed #D1D1D6', padding: '48px', textAlign: 'center', color: '#6B6B6B', background: '#fff' }}>
            {latestScan ? 'No violations found. Great job!' : 'Run a scan to see violations.'}
          </div>
        ) : (
          <div>
            {(['tier1', 'tier2', 'tier3', 'tier4'] as const).map(tier => {
              const group = byTier[tier]
              if (group.length === 0) return null
              return (
                <div key={tier} id={tier}>
                  <TierSection
                    tier={tier}
                    label={TIER_LABEL[tier]}
                    color={{ text: '', dot: '', hex: TIER_SWIMLANE[tier] }}
                    patterns={group}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Scan History */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1D1D1F', margin: '0 0 16px' }}>Scan History</h2>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E5EA', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F9F9FB', borderBottom: '1px solid #E5E5EA' }}>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Started</th>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</th>
                <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pages</th>
                <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Issues</th>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Triggered By</th>
                <th style={{ padding: '10px 16px' }} />
              </tr>
            </thead>
            <tbody>
              {scans.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#6B6B6B' }}>No scans yet.</td></tr>
              ) : scans.map((scan: any) => (
                <tr key={scan.id} style={{ borderTop: '1px solid #F0F0F0', cursor: 'pointer', position: 'relative' }}
                  className="group hover:bg-[#F5F5F7] transition-colors">
                  <td style={{ padding: '12px 16px', color: '#1D1D1F' }}>
                    <Link href={`/scans/${scan.id}`} style={{ position: 'absolute', inset: 0 }} aria-label={`View scan from ${formatDate(scan.started_at)}`} />
                    {formatDate(scan.started_at)}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ display: 'inline-flex', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, ...(STATUS_STYLE[scan.status] ?? STATUS_STYLE.queued) }}>
                      {scan.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: '#1D1D1F' }}>{scan.pages_scanned ?? 0}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: '#1D1D1F' }}>{scan.raw_violation_count ?? 0}</td>
                  <td style={{ padding: '12px 16px', color: '#6B6B6B', textTransform: 'capitalize' }}>{scan.triggered_by}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', position: 'relative', zIndex: 1 }}>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                      {(scan.status === 'running' || scan.status === 'queued') && <CancelScanButton jobId={scan.id} />}
                      {scan.status !== 'running' && scan.status !== 'queued' && <DeleteScanButton jobId={scan.id} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Configured Pages */}
      {pages.length > 0 && (
        <div>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1D1D1F', margin: '0 0 16px' }}>Configured Pages</h2>
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E5EA', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F9F9FB', borderBottom: '1px solid #E5E5EA' }}>
                  <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Label</th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>URL</th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Type</th>
                  <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>WCAG Errors</th>
                  <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {pages.map((page, i) => {
                  const ps = pageScores.find(s => s.url === page.url)
                  return (
                    <tr key={i} style={{ borderTop: '1px solid #F0F0F0' }} className="hover:bg-[#F5F5F7] transition-colors">
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1D1D1F' }}>{page.label}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <PageViolationsModal
                          pageScore={ps ?? { url: page.url, label: page.label, score: null as any, violationCount: null as any }}
                          patterns={patterns}
                        />
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ display: 'inline-flex', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#EFF6FF', color: '#1D4ED8', textTransform: 'capitalize' }}>
                          {page.templateType}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#1D1D1F' }}>{ps ? (ps.violationCount ?? '—') : '—'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        {!ps ? <span style={{ color: '#6B6B6B' }}>—</span>
                          : ps.score == null ? <span style={{ fontSize: 11, fontWeight: 600, background: '#FEF2F2', color: '#DC2626', padding: '2px 10px', borderRadius: 20 }}>Failed</span>
                          : <span style={{ fontSize: 11, color: '#6B6B6B' }}>Scanned</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
