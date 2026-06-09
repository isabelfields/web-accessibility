import { sql } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ViolationCard } from '@/components/ViolationCard'
import { PageViolationsModal } from '@/components/PageViolationsModal'
import { DeleteScanButton } from '@/components/DeleteScanButton'
import { SeverityBar } from '@/components/SeverityBar'
import { ExportPdfButton } from '@/components/ExportPdfButton'
import { patternsToWorstTier, TIER_LABEL, TIER_COLOR } from '@/lib/tiers'
import type { ViolationPattern, PageScore } from '@/types'

const RULE_WCAG_LEVEL: Record<string, 'A' | 'AA' | 'AAA'> = {
  'image-alt': 'A', 'button-name': 'A', 'label': 'A', 'link-name': 'A',
  'aria-required-attr': 'A', 'aria-valid-attr-value': 'A', 'aria-required-children': 'A',
  'aria-required-parent': 'A', 'aria-allowed-attr': 'A', 'document-title': 'A',
  'frame-title': 'A', 'heading-order': 'A', 'landmark-one-main': 'A',
  'landmark-no-duplicate-main': 'A', 'landmark-unique': 'A', 'landmark-main-is-top-level': 'A',
  'region': 'A', 'select-name': 'A', 'tabindex': 'A', 'html-has-lang': 'A', 'input-image-alt': 'A',
  'color-contrast': 'AA', 'video-caption': 'AA',
  'color-contrast-enhanced': 'AAA',
}

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

async function getScan(id: string) {
  const [scan] = await sql`SELECT * FROM scan_jobs WHERE id = ${id}`
  if (!scan) return null

  let site = null
  if (scan.site_id) {
    const [s] = await sql`SELECT id, name FROM sites WHERE id = ${scan.site_id}`
    site = s ?? null
  }

  return { scan, site }
}

function formatDate(d: string | Date | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const TIER_HEX: Record<string, string> = { tier1: '#002D82', tier2: '#005AC8', tier3: '#007AFF', tier4: '#5AC8FA' }

export default async function ScanDetailPage({ params }: RouteContext) {
  const { id } = await params
  const data = await getScan(id)
  if (!data) notFound()

  const { scan, site } = data
  const patterns: ViolationPattern[] = scan.patterns ?? []
  const pageScores: PageScore[] = scan.page_scores ?? []

  const byImpact: Record<string, ViolationPattern[]> = { critical: [], serious: [], moderate: [], minor: [] }
  for (const p of patterns) {
    if (byImpact[p.impact]) byImpact[p.impact].push(p)
  }

  const byTier = {
    tier1: byImpact.critical,
    tier2: byImpact.serious,
    tier3: byImpact.moderate,
    tier4: byImpact.minor,
  }

  const totalViolations = patterns.reduce((sum, p) => sum + p.occurrences, 0)
  const worstTier = patternsToWorstTier(patterns)

  const severityCounts = {
    critical: byImpact.critical.reduce((s, p) => s + p.occurrences, 0),
    serious:  byImpact.serious.reduce((s, p) => s + p.occurrences, 0),
    moderate: byImpact.moderate.reduce((s, p) => s + p.occurrences, 0),
    minor:    byImpact.minor.reduce((s, p) => s + p.occurrences, 0),
  }

  const wcagLevels = { A: 0, AA: 0, AAA: 0 }
  for (const p of patterns) {
    const level = RULE_WCAG_LEVEL[p.rule] ?? 'A'
    wcagLevels[level] += p.occurrences
  }

  return (
    <div style={{ padding: '24px 32px', background: '#F5F5F7', minHeight: '100vh' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#86868B', marginBottom: '20px' }}>
        <Link href="/" style={{ color: '#007AFF', textDecoration: 'none' }}>Dashboard</Link>
        <span style={{ color: '#D0D0D0' }}>/</span>
        {site && (
          <>
            <Link href={`/sites/${site.id}`} style={{ color: '#007AFF', textDecoration: 'none' }}>{site.name}</Link>
            <span style={{ color: '#D0D0D0' }}>/</span>
          </>
        )}
        <span style={{ color: '#1D1D1F', fontWeight: 500 }}>Scan {formatDate(scan.started_at)}</span>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1D1D1F', margin: 0 }}>
            {site?.name ?? scan.root_url}
          </h1>
          <p style={{ fontSize: '13px', color: '#86868B', marginTop: '4px' }}>{scan.root_url}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', padding: '2px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 500,
              ...(scan.status === 'complete' ? { background: 'rgba(52,199,89,0.12)', color: '#1A7F37' } :
                 scan.status === 'running'  ? { background: 'rgba(0,122,255,0.10)', color: '#007AFF' } :
                 scan.status === 'failed'   ? { background: 'rgba(255,59,48,0.10)', color: '#D70015' } :
                 { background: '#F5F5F7', color: '#86868B' })
            }}>
              {scan.status}
            </span>
            <span style={{ fontSize: '13px', color: '#3A3A3C' }}>{formatDate(scan.started_at)}</span>
            {scan.triggered_by && (
              <span style={{ fontSize: '13px', color: '#86868B', textTransform: 'capitalize' }}>· {scan.triggered_by}</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {scan.status === 'complete' && <ExportPdfButton scanId={scan.id} />}
          <DeleteScanButton jobId={scan.id} />
        </div>
      </div>

      {scan.status !== 'complete' ? (
        <div style={{ background: '#FFFFFF', borderRadius: '14px', border: '1px dashed #E0E0E0', padding: '48px', textAlign: 'center', color: '#86868B', fontSize: '14px' }}>
          {scan.status === 'failed' ? `Scan failed: ${scan.error ?? 'Unknown error'}` :
           scan.status === 'running' ? 'Scan is still running…' :
           scan.status === 'cancelled' ? 'Scan was cancelled.' : scan.status}
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '28px' }}>
            <div style={{ background: '#FFFFFF', borderRadius: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderLeft: worstTier ? `3px solid ${TIER_HEX[worstTier]}` : undefined }}>
              <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#86868B', marginBottom: '8px' }}>Priority</div>
              {worstTier ? (
                <>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: TIER_HEX[worstTier] }}>{TIER_LABEL[worstTier]}</div>
                  <div style={{ fontSize: '11px', color: '#86868B', marginTop: '4px' }}>highest tier found</div>
                </>
              ) : (
                <div style={{ fontSize: '16px', fontWeight: 600, color: '#34C759' }}>No issues</div>
              )}
            </div>

            <div style={{ background: '#FFFFFF', borderRadius: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#86868B', marginBottom: '8px' }}>WCAG Errors</div>
              <div style={{ fontSize: '36px', fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.03em', lineHeight: 1 }}>{totalViolations}</div>
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#86868B' }}>Issue types</span><span style={{ fontWeight: 600, color: '#1D1D1F' }}>{scan.unique_pattern_count ?? 0}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#86868B' }}>Pages scanned</span><span style={{ fontWeight: 600, color: '#1D1D1F' }}>{scan.pages_scanned ?? 0}</span></div>
              </div>
            </div>

            <div style={{ background: '#FFFFFF', borderRadius: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', padding: '20px' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#86868B', marginBottom: '16px' }}>By WCAG Level</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '20px' }}>
                {(['A', 'AA', 'AAA'] as const).map(lvl => (
                  <div key={lvl}>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.02em' }}>{wcagLevels[lvl]}</div>
                    <div style={{ fontSize: '11px', fontWeight: 500, color: '#86868B', marginTop: '2px' }}>Level {lvl}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: '#FFFFFF', borderRadius: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', padding: '20px' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#86868B', marginBottom: '16px' }}>By Tier</div>
              <SeverityBar counts={severityCounts} height="h-3" />
            </div>
          </div>

          {/* Per-page issues */}
          {pageScores.length > 0 && (
            <div style={{ marginBottom: '28px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1D1D1F', marginBottom: '16px' }}>Page Issues</h2>
              <div style={{ background: '#FFFFFF', borderRadius: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#F5F5F7', borderBottom: '1px solid #E0E0E0' }}>
                      <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: '10px', fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Page</th>
                      <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: '10px', fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>URL</th>
                      <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: '10px', fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>WCAG Errors</th>
                      <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: '10px', fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageScores.map((ps, i) => (
                      <PageViolationsModal key={i} pageScore={ps} patterns={patterns}>
                        <tr style={{ borderBottom: '1px solid #F0F0F0', cursor: ps.score != null ? 'pointer' : 'default', transition: 'background 0.12s' }}>
                          <td style={{ padding: '13px 16px', fontWeight: 500, color: '#1D1D1F' }}>{ps.label ?? '—'}</td>
                          <td style={{ padding: '13px 16px' }}>
                            <span style={{ color: '#007AFF', display: 'block', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ps.url}</span>
                            {ps.error && (
                              <div style={{ fontSize: '12px', color: '#D70015', marginTop: '2px', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ps.error}>
                                ⚠ {ps.error.length > 80 ? ps.error.slice(0, 80) + '…' : ps.error}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '13px 16px', textAlign: 'right', color: '#1D1D1F', fontWeight: 500 }}>{ps.violationCount ?? '—'}</td>
                          <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                            {ps.score == null
                              ? <span style={{ fontSize: '12px', fontWeight: 500, background: 'rgba(255,59,48,0.10)', color: '#D70015', padding: '2px 8px', borderRadius: '6px' }}>Failed</span>
                              : <span style={{ fontSize: '12px', color: '#34C759', fontWeight: 500 }}>Scanned</span>
                            }
                          </td>
                        </tr>
                      </PageViolationsModal>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Violations */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1D1D1F', margin: 0 }}>WCAG Errors Found</h2>
            <span style={{ fontSize: '13px', color: '#86868B' }}>{patterns.length} issue type{patterns.length !== 1 ? 's' : ''} · {totalViolations} total</span>
          </div>
          {patterns.length === 0 ? (
            <div style={{ background: '#FFFFFF', borderRadius: '14px', border: '1px dashed #E0E0E0', padding: '48px', textAlign: 'center', color: '#86868B', fontSize: '14px' }}>
              No WCAG errors found — great job!
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
        </>
      )}
    </div>
  )
}
