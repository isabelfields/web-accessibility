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
import { patternsToWorstTier, TIER_LABEL, impactToTier, TIER_COLOR } from '@/lib/tiers'
import { SeverityDonut } from '@/components/SeverityDonut'
import { formatDateTime } from '@/lib/format'
import { countComponentsWithIssues, countIssueTypes, countOccurrences, formatSignedDelta, getSeverityCounts, isActiveWcagPattern, isWcagPattern } from '@/lib/metrics'
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


function countPageWcagIssues(pageUrl: string, patterns: ViolationPattern[]): number {
  return patterns
    .filter(pattern => isWcagPattern(pattern) && (
      pattern.affectedPages?.includes(pageUrl) ||
      pattern.nodes?.some(node => node.url === pageUrl)
    ))
    .reduce((sum, pattern) => {
      const pageOccurrenceCount = pattern.pageOccurrences?.[pageUrl]
      if (pageOccurrenceCount != null) return sum + pageOccurrenceCount

      const pageNodeCount = pattern.nodes?.filter(node => node.url === pageUrl).length ?? 0
      return sum + (pageNodeCount || 1)
    }, 0)
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

  const triage: Record<string, string> = {}
  const rows = await sql`SELECT fingerprint, status FROM violation_triage WHERE site_id = ${id}`
  for (const r of rows) triage[r.fingerprint] = r.status

  return { site, scans, triage }
}


const STATUS_STYLE: Record<string, React.CSSProperties> = {
  complete: { background: '#ECFDF5', color: '#059669' },
  running:  { background: '#EFF6FF', color: '#2563EB' },
  failed:   { background: '#FEF2F2', color: '#DC2626' },
  queued:   { background: '#F3F4F6', color: '#57575A' },
}

export default async function SiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await getSiteData(id)
  if (!data) notFound()

  const { site, scans, triage } = data
  const pages: SitePage[] = (site.pages as SitePage[]) ?? []

  const completedScans = scans.filter((s: any) => s.status === 'complete')
  const latestScan = completedScans[0] ?? null
  const prevScan = completedScans[1] ?? null
  const pageScores: Array<{ url: string; label?: string; score: number | null; violationCount: number | null; error?: string }> =
    latestScan?.page_scores ?? []

  const patterns: ViolationPattern[] = latestScan?.patterns ?? []
  // Annotate triage state; "active" excludes triaged (dismissed) patterns.
  for (const p of patterns) p.triageStatus = (triage[p.fingerprint] as ViolationPattern['triageStatus']) ?? 'open'
  const activePatterns = patterns.filter(p => (p.triageStatus ?? 'open') === 'open')
  const activeWcagPatterns = activePatterns.filter(isWcagPattern)
  const dismissedWcagPatterns = patterns.filter(p => isWcagPattern(p) && (p.triageStatus ?? 'open') !== 'open')

  const byTier: Record<string, ViolationPattern[]> = { tier1: [], tier2: [], tier3: [], tier4: [] }
  for (const p of activeWcagPatterns) {
    byTier[impactToTier(p.impact)].push(p)
  }
  const worstTier = patternsToWorstTier(activeWcagPatterns)

  // Active WCAG counts exclude best-practice-only findings and triaged patterns.
  const severityCounts = getSeverityCounts(activeWcagPatterns)
  const totalViolations = countOccurrences(activeWcagPatterns)
  const activeComponentsWithIssues = countComponentsWithIssues(activeWcagPatterns)
  const activeIssueTypes = countIssueTypes(activeWcagPatterns)

  const prevPatterns = (prevScan?.patterns ?? []) as ViolationPattern[]
  for (const p of prevPatterns) p.triageStatus = (triage[p.fingerprint] as ViolationPattern['triageStatus']) ?? 'open'

  // The badge sits next to the displayed active total, so compare active WCAG totals.
  const currentErrors = latestScan ? totalViolations : null
  const prevErrors = prevScan ? countOccurrences(prevPatterns, isActiveWcagPattern) : null
  const errorDelta = (currentErrors !== null && prevErrors !== null) ? currentErrors - prevErrors : null

  // Tiers present (for jump nav)
  const presentTiers = (['tier1', 'tier2', 'tier3', 'tier4'] as const).filter(t => byTier[t].length > 0)

  // Trend data for chart (oldest → newest)
  const trendPoints = completedScans
    .slice(0, 10)
    .reverse()
    .map((s: any) => ({
      date: new Date(s.started_at).toISOString().split('T')[0],
      count: countOccurrences((s.patterns ?? []) as ViolationPattern[], isWcagPattern),
    }))

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F7' }}>

      {/* Sticky top bar */}
      <div className="app-topbar" style={{ borderBottom: '1px solid #E5E5EA', minHeight: 96, padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10, background: 'rgba(245,245,247,0.92)', backdropFilter: 'blur(8px)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginBottom: 2 }}>
            <Link href="/sites" style={{ color: '#007AFF', fontWeight: 500 }}>Sites</Link>
            <span style={{ color: '#57575A' }}>/</span>
            <span style={{ color: '#57575A' }}>{site.name}</span>
          </div>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: '#1D1D1F', margin: 0, letterSpacing: '-0.01em' }}>{site.name}</h1>
          {latestScan && (
            <p style={{ fontSize: 12, color: '#57575A', margin: 0 }}>
              Last scanned {formatDateTime(latestScan.started_at)}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <EditSiteButton site={{ id: site.id, name: site.name, division: site.division, brand: site.brand, region: site.region, pages }} />
          <RunScanButton siteId={site.id} />
        </div>
      </div>

      <div className="page-shell" style={{ padding: '24px 32px' }}>

      {/* Stat cards */}
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16, marginBottom: 20 }}>

        {/* Priority — navy left accent */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E5EA', borderLeft: '4px solid #002D82', padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#57575A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Priority</div>
          {worstTier ? (
            <>
              <div style={{ fontSize: 40, fontWeight: 800, color: TIER_SWIMLANE[worstTier], letterSpacing: '-0.02em', lineHeight: 1 }}>
                {TIER_LABEL[worstTier]}
              </div>
              <div style={{ fontSize: 12, color: '#57575A', marginTop: 8 }}>highest tier found</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#059669', lineHeight: 1 }}>{latestScan ? 'No issues' : 'No scans'}</div>
              <div style={{ fontSize: 12, color: '#57575A', marginTop: 8 }}>{latestScan ? 'All clear' : 'Run a scan'}</div>
            </>
          )}
        </div>

        {/* Total Issues */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E5EA', borderLeft: '4px solid #007AFF', padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#57575A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Total Issues</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 40, fontWeight: 800, color: '#007AFF', letterSpacing: '-0.02em', lineHeight: 1 }}>{latestScan ? totalViolations : '—'}</div>
            {errorDelta !== null && errorDelta !== 0 && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 8px',
                borderRadius: 20, fontSize: 11, fontWeight: 700,
                background: errorDelta > 0 ? '#FEF2F2' : '#ECFDF5',
                color: errorDelta > 0 ? '#DC2626' : '#059669',
              }}>
                {formatSignedDelta(errorDelta)}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#57575A', marginTop: 8 }}>active WCAG failures</div>
        </div>

        {/* Components with Issues */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E5EA', borderLeft: '4px solid #3B82F6', padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#57575A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Components with Issues</div>
          <div style={{ fontSize: 40, fontWeight: 800, color: '#1D4ED8', letterSpacing: '-0.02em', lineHeight: 1 }}>{latestScan ? activeComponentsWithIssues : '—'}</div>
          <div style={{ fontSize: 12, color: '#57575A', marginTop: 8 }}>deduped affected components</div>
        </div>

        {/* Issue Types */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E5EA', borderLeft: '4px solid #60a5fa', padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#57575A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Issue Types</div>
          <div style={{ fontSize: 40, fontWeight: 800, color: '#2563eb', letterSpacing: '-0.02em', lineHeight: 1 }}>{activeIssueTypes}</div>
          <div style={{ fontSize: 12, color: '#57575A', marginTop: 8 }}>unique active issue types</div>
        </div>

        {/* Pages Scanned */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E5EA', padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#57575A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Pages Scanned</div>
          <div style={{ fontSize: 40, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.02em', lineHeight: 1 }}>{latestScan?.pages_scanned ?? '—'}</div>
          <div style={{ fontSize: 12, color: '#57575A', marginTop: 8 }}>{pages.length} configured</div>
        </div>

        {/* Total Scans */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E5EA', padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#57575A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Total Scans</div>
          <div style={{ fontSize: 40, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.02em', lineHeight: 1 }}>{scans.length}</div>
          <div style={{ fontSize: 12, color: '#57575A', marginTop: 8 }}>{completedScans.length} completed</div>
        </div>
      </div>

      {/* Donut + Trend charts row */}
      {(totalViolations > 0 || trendPoints.length >= 2) && (
        <div className="charts-grid" style={{ display: 'grid', gridTemplateColumns: totalViolations > 0 && trendPoints.length >= 2 ? '1fr 1fr' : '1fr', gap: 16, marginBottom: 28 }}>
          {totalViolations > 0 && (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E5EA', padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#57575A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Issues by Tier</div>
              <div style={{ fontSize: 11, color: '#57575A', marginBottom: 12 }}>Total component instances grouped by tier</div>
              <SeverityDonut counts={severityCounts} />
            </div>
          )}
          {trendPoints.length >= 2 && (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E5EA', padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#57575A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Issue Count Over Time</div>
              <div style={{ fontSize: 11, color: '#57575A', marginBottom: 12 }}>Component instances across scans</div>
              <SiteTrendChart points={trendPoints} />
            </div>
          )}
        </div>
      )}

      {/* Component Issues — swimlane layout */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1D1D1F', margin: 0 }}>Component Issues</h2>
          {presentTiers.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#57575A', marginRight: 4 }}>Jump to</span>
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

        {activeWcagPatterns.length === 0 ? (
          <div style={{ borderRadius: 12, border: '1.5px dashed #D1D1D6', padding: '48px', textAlign: 'center', color: '#57575A', background: '#fff' }}>
            {!latestScan ? 'Run a scan to see component issues.'
              : dismissedWcagPatterns.length > 0 ? 'No active component issues — all WCAG issues have been dismissed.'
              : 'No WCAG component issues found. Great job!'}
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
                    siteId={site.id}
                  />
                </div>
              )
            })}
          </div>
        )}

        {dismissedWcagPatterns.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <TierSection
              tier="dismissed"
              label={`Dismissed (${dismissedWcagPatterns.length})`}
              color={{ text: '#57575A', dot: '#9CA3AF', hex: '#9CA3AF' }}
              patterns={dismissedWcagPatterns}
              siteId={site.id}
              defaultOpen={false}
            />
          </div>
        )}
      </div>

      {/* Scan History */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1D1D1F', margin: '0 0 16px' }}>Scan History</h2>
        <div className="table-scroll" style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E5EA', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F9F9FB', borderBottom: '1px solid #E5E5EA' }}>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#57575A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Started</th>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#57575A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</th>
                <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#57575A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pages</th>
                <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#57575A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Issues</th>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#57575A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Triggered By</th>
                <th style={{ padding: '10px 16px' }} />
              </tr>
            </thead>
            <tbody>
              {scans.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#57575A' }}>No scans yet.</td></tr>
              ) : scans.map((scan: any) => (
                <tr key={scan.id} style={{ borderTop: '1px solid #F0F0F0', cursor: 'pointer', position: 'relative' }}
                  className="group hover:bg-[#F5F5F7] transition-colors">
                  <td style={{ padding: '12px 16px', color: '#1D1D1F' }}>
                    <Link href={`/scans/${scan.id}`} style={{ position: 'absolute', inset: 0 }} aria-label={`View scan from ${formatDateTime(scan.started_at)}`} />
                    {formatDateTime(scan.started_at)}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ display: 'inline-flex', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, ...(STATUS_STYLE[scan.status] ?? STATUS_STYLE.queued) }}>
                      {scan.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: '#1D1D1F' }}>{scan.pages_scanned ?? 0}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: '#1D1D1F' }}>{countOccurrences((scan.patterns ?? []) as ViolationPattern[], isWcagPattern)}</td>
                  <td style={{ padding: '12px 16px', color: '#57575A', textTransform: 'capitalize' }}>{scan.triggered_by}</td>
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
          <div className="table-scroll" style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E5EA', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F9F9FB', borderBottom: '1px solid #E5E5EA' }}>
                  <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#57575A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Label</th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#57575A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>URL</th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#57575A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Type</th>
                  <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#57575A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Issues</th>
                  <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#57575A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {pages.map((page, i) => {
                  const ps = pageScores.find(s => s.url === page.url)
                  const pageIssueCount = countPageWcagIssues(page.url, patterns)
                  return (
                    <tr key={i} style={{ borderTop: '1px solid #F0F0F0' }} className="hover:bg-[#F5F5F7] transition-colors">
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1D1D1F' }}>{page.label}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <PageViolationsModal
                          pageScore={ps ?? { url: page.url, label: page.label, score: null, violationCount: null }}
                          patterns={patterns}
                        />
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ display: 'inline-flex', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#EFF6FF', color: '#1D4ED8', textTransform: 'capitalize' }}>
                          {page.templateType}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#1D1D1F' }}>{ps?.score == null ? '—' : pageIssueCount}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        {!ps ? <span style={{ color: '#57575A' }}>—</span>
                          : ps.score == null ? <span style={{ fontSize: 11, fontWeight: 600, background: '#FEF2F2', color: '#DC2626', padding: '2px 10px', borderRadius: 20 }}>Failed</span>
                          : <span style={{ fontSize: 11, color: '#57575A' }}>Scanned</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      </div>{/* end padding wrapper */}
    </div>
  )
}
