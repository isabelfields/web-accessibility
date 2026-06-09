import { sql } from '@/lib/db'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { RunScanButton } from '@/components/RunScanButton'
import { CancelScanButton } from '@/components/CancelScanButton'
import { DeleteScanButton } from '@/components/DeleteScanButton'
import { ViolationCard } from '@/components/ViolationCard'
import { EditSiteButton } from '@/components/EditSiteButton'
import { PageViolationsModal } from '@/components/PageViolationsModal'
import { SiteTrendChart } from '@/components/SiteTrendChart'
import { patternsToWorstTier, TIER_LABEL, TIER_COLOR, impactToTier } from '@/lib/tiers'
import type { ViolationPattern, SitePage } from '@/types'

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

export default async function SiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await getSiteData(id)
  if (!data) notFound()

  const { site, scans } = data
  const pages: SitePage[] = (site.pages as SitePage[]) ?? []

  const completedScans = scans.filter((s: any) => s.status === 'complete')
  const latestScan = completedScans[0] ?? null
  const pageScores: Array<{ url: string; label?: string; score: number | null; violationCount: number | null; error?: string }> =
    latestScan?.page_scores ?? []

  const patterns: ViolationPattern[] = latestScan?.patterns ?? []
  const byTier: Record<string, ViolationPattern[]> = { tier1: [], tier2: [], tier3: [], tier4: [] }
  for (const p of patterns) {
    const t = impactToTier(p.impact)
    byTier[t].push(p)
  }
  const worstTier = patternsToWorstTier(patterns)

  const TIER_HEX: Record<string, string> = { tier1: '#002D82', tier2: '#005AC8', tier3: '#007AFF', tier4: '#5AC8FA' }

  // Build site-level trend from completed scans (oldest → newest)
  const siteTrend = [...completedScans].reverse().map((s: any) => ({
    date: new Date(s.completed_at ?? s.started_at).toISOString(),
    errors: s.raw_violation_count ?? 0,
    score: s.score ?? null,
  }))

  return (
    <div style={{ padding: '24px 32px', background: '#F5F5F7', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#86868B', marginBottom: '6px' }}>
            <Link href="/sites" style={{ color: '#007AFF', textDecoration: 'none' }}>Sites</Link>
            <span style={{ color: '#D0D0D0' }}>/</span>
            <span style={{ color: '#1D1D1F', fontWeight: 500 }}>{site.name}</span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1D1D1F', margin: 0 }}>{site.name}</h1>
          {latestScan && (
            <p style={{ fontSize: '13px', color: '#86868B', marginTop: '4px' }}>
              Last scanned {formatDate(latestScan.started_at)}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <EditSiteButton site={{ id: site.id, name: site.name, division: site.division, pages }} />
          <RunScanButton siteId={site.id} />
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '28px' }}>
        <div style={{ background: '#FFFFFF', borderRadius: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderLeft: worstTier ? `3px solid ${TIER_HEX[worstTier]}` : undefined }}>
          <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#86868B', marginBottom: '8px' }}>Priority</div>
          {worstTier ? (
            <>
              <div style={{ fontSize: '22px', fontWeight: 700, color: TIER_HEX[worstTier] }}>{TIER_LABEL[worstTier]}</div>
              <div style={{ fontSize: '11px', color: '#86868B', marginTop: '4px' }}>highest tier found</div>
            </>
          ) : (
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#34C759' }}>{latestScan ? 'No issues' : 'No scans yet'}</div>
          )}
        </div>

        <div style={{ background: '#FFFFFF', borderRadius: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', padding: '20px' }}>
          <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#86868B', marginBottom: '8px' }}>WCAG Errors</div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: '#1D1D1F', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '-0.03em' }}>{latestScan?.raw_violation_count ?? '—'}</div>
          <div style={{ fontSize: '11px', color: '#86868B', marginTop: '4px' }}>{latestScan?.unique_pattern_count ?? 0} issue types</div>
        </div>

        <div style={{ background: '#FFFFFF', borderRadius: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', padding: '20px' }}>
          <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#86868B', marginBottom: '8px' }}>Pages Scanned</div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: '#1D1D1F', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '-0.03em' }}>{latestScan?.pages_scanned ?? '—'}</div>
          <div style={{ fontSize: '11px', color: '#86868B', marginTop: '4px' }}>{pages.length} configured</div>
        </div>

        <div style={{ background: '#FFFFFF', borderRadius: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', padding: '20px' }}>
          <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#86868B', marginBottom: '8px' }}>Total Scans</div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: '#1D1D1F', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '-0.03em' }}>{scans.length}</div>
          <div style={{ fontSize: '11px', color: '#86868B', marginTop: '4px' }}>{completedScans.length} completed</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

        {/* Trends */}
        {completedScans.length > 0 && (
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1D1D1F', marginBottom: '16px' }}>Trends</h2>
            <div style={{ background: '#FFFFFF', borderRadius: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', padding: '20px' }}>
              <SiteTrendChart data={siteTrend} />
            </div>
          </div>
        )}

        {/* Violations */}
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1D1D1F', marginBottom: '16px' }}>WCAG Errors</h2>
          {patterns.length === 0 ? (
            <div style={{ background: '#FFFFFF', borderRadius: '14px', border: '1px dashed #E0E0E0', padding: '40px', textAlign: 'center', color: '#86868B', fontSize: '14px' }}>
              {latestScan ? 'No violations found. Great job!' : 'Run a scan to see violations.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {(['tier1', 'tier2', 'tier3', 'tier4'] as const).map(tier => {
                const group = byTier[tier]
                if (group.length === 0) return null
                const hex = TIER_HEX[tier]
                return (
                  <div key={tier}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', padding: '0 4px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: hex, flexShrink: 0, display: 'inline-block' }} />
                      <h3 style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: hex, margin: 0 }}>{TIER_LABEL[tier]}</h3>
                      <span style={{ fontSize: '12px', color: '#86868B', fontWeight: 500 }}>{group.length} issue type{group.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {group.map(p => (
                        <ViolationCard key={p.fingerprint} pattern={p} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Scan History */}
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1D1D1F', marginBottom: '16px' }}>Scan History</h2>
          <div style={{ background: '#FFFFFF', borderRadius: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#F5F5F7', borderBottom: '1px solid #E0E0E0' }}>
                  <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: '10px', fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Started</th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: '10px', fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Status</th>
                  <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: '10px', fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Pages</th>
                  <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: '10px', fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Issues</th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: '10px', fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Triggered By</th>
                  <th style={{ padding: '10px 16px' }}></th>
                </tr>
              </thead>
              <tbody>
                {scans.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#86868B', fontSize: '14px' }}>No scans yet.</td>
                  </tr>
                ) : (
                  scans.map((scan: any) => (
                    <tr key={scan.id} className="group" style={{ borderBottom: '1px solid #F0F0F0', position: 'relative', cursor: 'pointer', transition: 'background 0.12s' }}>
                      <td style={{ padding: '13px 16px', color: '#1D1D1F' }}>
                        <Link href={`/scans/${scan.id}`} style={{ position: 'absolute', inset: 0 }} aria-label={`View scan from ${formatDate(scan.started_at)}`} />
                        {formatDate(scan.started_at)}
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', padding: '2px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 500,
                          ...(scan.status === 'complete' ? { background: 'rgba(52,199,89,0.12)', color: '#1A7F37' } :
                             scan.status === 'running'  ? { background: 'rgba(0,122,255,0.10)', color: '#007AFF' } :
                             scan.status === 'failed'   ? { background: 'rgba(255,59,48,0.10)', color: '#D70015' } :
                             { background: '#F5F5F7', color: '#86868B' })
                        }}>
                          {scan.status}
                        </span>
                      </td>
                      <td style={{ padding: '13px 16px', textAlign: 'right', color: '#1D1D1F', fontFamily: '"JetBrains Mono", monospace' }}>{scan.pages_scanned ?? 0}</td>
                      <td style={{ padding: '13px 16px', textAlign: 'right', color: '#1D1D1F', fontFamily: '"JetBrains Mono", monospace' }}>{scan.raw_violation_count ?? 0}</td>
                      <td style={{ padding: '13px 16px', color: '#3A3A3C', textTransform: 'capitalize' }}>{scan.triggered_by}</td>
                      <td style={{ padding: '13px 16px', textAlign: 'right', position: 'relative', zIndex: 10 }}>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                          {(scan.status === 'running' || scan.status === 'queued') && (
                            <CancelScanButton jobId={scan.id} />
                          )}
                          {scan.status !== 'running' && scan.status !== 'queued' && (
                            <DeleteScanButton jobId={scan.id} />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pages */}
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1D1D1F', marginBottom: '16px' }}>Configured Pages</h2>
          {pages.length === 0 ? (
            <div style={{ color: '#86868B', fontStyle: 'italic', fontSize: '14px' }}>No pages configured.</div>
          ) : (
            <div style={{ background: '#FFFFFF', borderRadius: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#F5F5F7', borderBottom: '1px solid #E0E0E0' }}>
                    <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: '10px', fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Label</th>
                    <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: '10px', fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>URL</th>
                    <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: '10px', fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Template Type</th>
                    <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: '10px', fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>WCAG Errors</th>
                    <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: '10px', fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.map((page, i) => {
                    const ps = pageScores.find(s => s.url === page.url)
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #F0F0F0', transition: 'background 0.12s' }}>
                        <td style={{ padding: '13px 16px', fontWeight: 500, color: '#1D1D1F' }}>{page.label}</td>
                        <td style={{ padding: '13px 16px' }}>
                          <PageViolationsModal
                            pageScore={ps ?? { url: page.url, label: page.label, score: null as any, violationCount: null as any }}
                            patterns={patterns}
                          />
                        </td>
                        <td style={{ padding: '13px 16px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 500, background: '#F5F5F7', color: '#3A3A3C', textTransform: 'capitalize' }}>
                            {page.templateType}
                          </span>
                        </td>
                        <td style={{ padding: '13px 16px', textAlign: 'right', color: '#1D1D1F', fontFamily: '"JetBrains Mono", monospace' }}>
                          {ps ? (ps.violationCount ?? '—') : '—'}
                        </td>
                        <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                          {!ps
                            ? <span style={{ fontSize: '12px', color: '#86868B' }}>—</span>
                            : ps.score == null
                              ? <span style={{ fontSize: '12px', fontWeight: 500, background: 'rgba(255,59,48,0.10)', color: '#D70015', padding: '2px 8px', borderRadius: '6px' }}>Failed</span>
                              : <span style={{ fontSize: '12px', color: '#34C759', fontWeight: 500 }}>Scanned</span>
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
