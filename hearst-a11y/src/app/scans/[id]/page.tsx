import { sql } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { TierSection } from '@/components/TierSection'
import { PageViolationsModal } from '@/components/PageViolationsModal'
import { DeleteScanButton } from '@/components/DeleteScanButton'
import { SeverityBar } from '@/components/SeverityBar'
import { ExportPdfButton } from '@/components/ExportPdfButton'
import { patternsToWorstTier, TIER_LABEL, TIER_COLOR } from '@/lib/tiers'
import { formatDateTime } from '@/lib/format'
import type { ViolationPattern, PageScore } from '@/types'

const RULE_WCAG_LEVEL: Record<string, 'A' | 'AA'> = {
  'image-alt': 'A', 'button-name': 'A', 'label': 'A', 'link-name': 'A',
  'aria-required-attr': 'A', 'aria-valid-attr-value': 'A', 'aria-required-children': 'A',
  'aria-required-parent': 'A', 'aria-allowed-attr': 'A', 'document-title': 'A',
  'frame-title': 'A', 'heading-order': 'A', 'landmark-one-main': 'A',
  'landmark-no-duplicate-main': 'A', 'landmark-unique': 'A', 'landmark-main-is-top-level': 'A',
  'region': 'A', 'select-name': 'A', 'tabindex': 'A', 'html-has-lang': 'A', 'input-image-alt': 'A',
  'color-contrast': 'AA', 'video-caption': 'AA',
}

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

async function getScan(id: string) {
  const [scan] = await sql`SELECT * FROM scan_jobs WHERE id = ${id}`
  if (!scan) return null

  let site = null
  let prevScan = null
  if (scan.site_id) {
    const [s] = await sql`SELECT id, name FROM sites WHERE id = ${scan.site_id}`
    site = s ?? null
    // Previous completed scan of the same site, for the diff/regression view.
    const [prev] = await sql`
      SELECT id, raw_violation_count, started_at, COALESCE(patterns, '[]'::jsonb) AS patterns
      FROM scan_jobs
      WHERE site_id = ${scan.site_id} AND status = 'complete' AND started_at < ${scan.started_at}
      ORDER BY started_at DESC LIMIT 1
    `
    prevScan = prev ?? null
  }

  // Triage state for this site (fingerprint -> status), persists across scans.
  const triage: Record<string, string> = {}
  if (scan.site_id) {
    const rows = await sql`SELECT fingerprint, status FROM violation_triage WHERE site_id = ${scan.site_id}`
    for (const r of rows) triage[r.fingerprint] = r.status
  }

  return { scan, site, prevScan, triage }
}

export default async function ScanDetailPage({ params }: RouteContext) {
  const { id } = await params
  const data = await getScan(id)
  if (!data) notFound()

  const { scan, site, prevScan, triage } = data
  const patterns: ViolationPattern[] = scan.patterns ?? []
  const pageScores: PageScore[] = scan.page_scores ?? []

  // Annotate each pattern with its triage state; "active" = open/untriaged.
  for (const p of patterns) p.triageStatus = (triage[p.fingerprint] as ViolationPattern['triageStatus']) ?? 'open'
  const activePatterns = patterns.filter(p => (p.triageStatus ?? 'open') === 'open')
  const dismissedPatterns = patterns.filter(p => (p.triageStatus ?? 'open') !== 'open')

  // Diff against the previous completed scan of this site.
  const prevPatterns: ViolationPattern[] = prevScan?.patterns ?? []
  const prevFingerprints = new Set(prevPatterns.map(p => p.fingerprint))
  const currentFingerprints = new Set(patterns.map(p => p.fingerprint))
  for (const p of patterns) p.isNew = prevScan ? !prevFingerprints.has(p.fingerprint) : false
  const newCount = patterns.filter(p => p.isNew).length
  const resolvedPatterns = prevPatterns.filter(p => !currentFingerprints.has(p.fingerprint))
  const carriedOver = patterns.length - newCount
  const prevTotal = prevPatterns.reduce((s, p) => s + p.occurrences, 0)
  const currentTotal = patterns.reduce((s, p) => s + p.occurrences, 0)
  const errorDelta = currentTotal - prevTotal
  const hasMoreErrors = prevScan != null && errorDelta > 0
  const hasFewerErrors = prevScan != null && errorDelta < 0
  const currentErrorLabel = currentTotal === 1 ? 'error' : 'errors'

  const byImpact: Record<string, ViolationPattern[]> = { critical: [], serious: [], moderate: [], minor: [] }
  for (const p of activePatterns) {
    if (byImpact[p.impact]) byImpact[p.impact].push(p)
  }

  // Group into tiers for display
  const byTier = {
    tier1: byImpact.critical,
    tier2: byImpact.serious,
    tier3: byImpact.moderate,
    tier4: byImpact.minor,
  }

  // "Active" totals exclude best-practice (no score impact) and triaged patterns
  // (fixed/won't-fix/false-positive). The violation list below (byTier) still
  // shows every pattern, with triaged ones de-emphasized.
  const isActive = (p: ViolationPattern) => !p.isBestPractice && (p.triageStatus ?? 'open') === 'open'
  const totalViolations = activePatterns.reduce((sum, p) => sum + p.occurrences, 0)
  const worstTier = patternsToWorstTier(activePatterns.filter(p => !p.isBestPractice))

  const occ = (list: ViolationPattern[]) =>
    list.filter(isActive).reduce((s, p) => s + p.occurrences, 0)
  const severityCounts = {
    critical: occ(byImpact.critical),
    serious:  occ(byImpact.serious),
    moderate: occ(byImpact.moderate),
    minor:    occ(byImpact.minor),
  }

  const wcagLevels = { A: 0, AA: 0 }
  for (const p of patterns) {
    if (!isActive(p)) continue
    const level = RULE_WCAG_LEVEL[p.rule] ?? 'A'
    wcagLevels[level] += p.occurrences
  }

  return (
    <div className="px-8 py-6 bg-[#F5F5F7] min-h-screen">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[#57575A] mb-6">
        <Link href="/" className="hover:text-[#1D1D1F]">Dashboard</Link>
        <span className="text-[#A1A1A6]">/</span>
        {site && (
          <>
            <Link href={`/sites/${site.id}`} className="hover:text-[#1D1D1F]">{site.name}</Link>
            <span className="text-[#A1A1A6]">/</span>
          </>
        )}
        <span className="text-[#1D1D1F] font-medium">Scan {formatDateTime(scan.started_at)}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#1D1D1F]">
            {site?.name ?? scan.root_url}
          </h1>
          <p className="text-sm text-[#57575A] mt-1">{scan.root_url}</p>
          <div className="flex items-center gap-3 mt-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              scan.status === 'complete' ? 'bg-emerald-100 text-emerald-700' :
              scan.status === 'running' ? 'bg-blue-100 text-blue-700' :
              scan.status === 'failed' ? 'bg-red-100 text-red-700' :
              'bg-[#F5F5F7] text-[#57575A]'
            }`}>
              {scan.status}
            </span>
            <span className="text-sm text-[#3A3A3C]">{formatDateTime(scan.started_at)}</span>
            {scan.triggered_by && (
              <span className="text-sm text-[#3A3A3C] capitalize">· {scan.triggered_by}</span>
            )}
            {scan.status === 'complete' && prevScan && (
              hasMoreErrors ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                  {currentTotal} {currentErrorLabel} (+{errorDelta} since last scan)
                </span>
              ) : hasFewerErrors ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                  {currentTotal} {currentErrorLabel} ({errorDelta} since last scan)
                </span>
              ) : null
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {scan.status === 'complete' && <ExportPdfButton scanId={scan.id} />}
          <DeleteScanButton jobId={scan.id} />
        </div>
      </div>

      {scan.status !== 'complete' ? (
        <div className="bg-white border border-dashed border-[#E5E5EA] rounded-xl p-12 text-center text-[#3A3A3C]">
          {scan.status === 'failed' ? `Scan failed: ${scan.error ?? 'Unknown error'}` :
           scan.status === 'running' ? 'Scan is still running…' :
           scan.status === 'cancelled' ? 'Scan was cancelled.' : scan.status}
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            {/* Priority tier */}
            <div className="rounded-lg bg-white border border-[#E5E5EA] p-6 flex flex-col items-center justify-center">
              <div className="text-[11px] font-semibold text-[#3A3A3C] uppercase tracking-wider mb-3">Priority</div>
              {worstTier ? (
                <>
                  <div className={`text-2xl font-bold ${TIER_COLOR[worstTier].text}`}>{TIER_LABEL[worstTier]}</div>
                  <div className="text-xs text-[#3A3A3C] mt-1">highest tier found</div>
                </>
              ) : (
                <div className="text-lg font-semibold text-emerald-600">No issues</div>
              )}
            </div>

            {/* Violations summary */}
            <div className="rounded-lg bg-white border border-[#E5E5EA] p-6 flex flex-col justify-between">
              <div className="text-[11px] font-semibold text-[#3A3A3C] uppercase tracking-wider mb-3">WCAG Errors</div>
              <div className="text-4xl font-bold text-[#1D1D1F] tabular-nums leading-none">{totalViolations}</div>
              <div className="mt-3 space-y-1.5 text-xs text-[#3A3A3C]">
                <div className="flex justify-between"><span>Issue types</span><span className="font-semibold text-[#1D1D1F]">{scan.unique_pattern_count ?? 0}</span></div>
                <div className="flex justify-between"><span>Pages scanned</span><span className="font-semibold text-[#1D1D1F]">{scan.pages_scanned ?? 0}</span></div>
              </div>
            </div>

            {/* WCAG A / AA */}
            <div className="rounded-lg bg-white border border-[#E5E5EA] p-6">
              <div className="text-[11px] font-semibold text-[#3A3A3C] uppercase tracking-wider mb-4">By WCAG Level</div>
              <div className="flex items-end gap-5">
                <div>
                  <div className="text-2xl font-bold text-[#1D1D1F] tabular-nums">{wcagLevels.A}</div>
                  <div className="text-[11px] font-semibold text-[#3A3A3C] mt-0.5">Level A</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-[#1D1D1F] tabular-nums">{wcagLevels.AA}</div>
                  <div className="text-[11px] font-semibold text-[#3A3A3C] mt-0.5">Level AA</div>
                </div>
              </div>
            </div>

            {/* Tier breakdown bar */}
            <div className="rounded-lg bg-white border border-[#E5E5EA] p-6">
              <div className="text-[11px] font-semibold text-[#3A3A3C] uppercase tracking-wider mb-4">By Tier</div>
              <SeverityBar counts={severityCounts} height="h-3" />
            </div>
          </div>

          {/* Change since last scan */}
          {prevScan && (
            <div className="mb-8 rounded-lg bg-white border border-[#E5E5EA] p-5">
              <div className="text-[11px] font-semibold text-[#3A3A3C] uppercase tracking-wider mb-3">Change since last scan</div>
              <div className="flex flex-wrap gap-6 text-sm">
                <div><span className="text-lg font-bold text-red-600 tabular-nums">{newCount}</span> <span className="text-[#3A3A3C]">new issue type{newCount !== 1 ? 's' : ''}</span></div>
                <div><span className="text-lg font-bold text-emerald-600 tabular-nums">{resolvedPatterns.length}</span> <span className="text-[#3A3A3C]">resolved</span></div>
                <div><span className="text-lg font-bold text-[#1D1D1F] tabular-nums">{carriedOver}</span> <span className="text-[#3A3A3C]">carried over</span></div>
              </div>
              {resolvedPatterns.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[#F0F0F0]">
                  <div className="text-xs font-semibold text-[#57575A] mb-1.5">Resolved rules</div>
                  <div className="flex flex-wrap gap-1.5">
                    {resolvedPatterns.map(p => (
                      <span key={p.fingerprint} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700">
                        {p.rule}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Per-page issues */}
          {pageScores.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-[#1D1D1F] mb-4">Page Issues</h2>
              <div className="rounded-lg bg-white border border-[#E5E5EA] overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#F5F5F7] border-b border-[#E5E5EA]">
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#3A3A3C] uppercase tracking-wider">Page</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#3A3A3C] uppercase tracking-wider">URL</th>
                      <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#3A3A3C] uppercase tracking-wider">WCAG Errors</th>
                      <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#3A3A3C] uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageScores.map((ps, i) => (
                      <PageViolationsModal key={i} pageScore={ps} patterns={patterns}>
                        <tr className={`border-t border-[#E5E5EA] transition-colors ${ps.score != null ? 'hover:bg-[#F5F5F7] cursor-pointer' : ''}`}>
                          <td className="px-4 py-3 font-medium text-[#1D1D1F]">{ps.label ?? '—'}</td>
                          <td className="px-4 py-3">
                            <span className="text-[#1d4ed8] truncate block max-w-sm">{ps.url}</span>
                            {ps.error && (
                              <div className="text-xs text-red-600 mt-0.5 truncate max-w-sm" title={ps.error}>
                                ⚠ {ps.error.length > 80 ? ps.error.slice(0, 80) + '…' : ps.error}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-[#1D1D1F]">{ps.violationCount ?? '—'}</td>
                          <td className="px-4 py-3 text-right">
                            {ps.score == null
                              ? <span className="text-xs font-normal bg-red-100 text-red-700 px-2 py-0.5 rounded-md">Failed</span>
                              : <span className="text-xs text-[#3A3A3C]">Scanned</span>
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[#1D1D1F]">WCAG Errors Found</h2>
            <span className="text-sm text-[#3A3A3C]">{activePatterns.length} issue type{activePatterns.length !== 1 ? 's' : ''} · {totalViolations} total</span>
          </div>
          {activePatterns.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-[#E5E5EA] p-12 text-center text-[#3A3A3C]">
              {dismissedPatterns.length > 0 ? 'No active WCAG errors — all issues have been dismissed.' : 'No WCAG errors found — great job!'}
            </div>
          ) : (
            <div>
              {(['tier1', 'tier2', 'tier3', 'tier4'] as const).map(tier => {
                const group = byTier[tier]
                if (group.length === 0) return null
                const c = TIER_COLOR[tier]
                return (
                  <TierSection
                    key={tier}
                    tier={tier}
                    label={TIER_LABEL[tier]}
                    color={{ text: c.text, dot: c.dot, hex: c.hex }}
                    patterns={group}
                    siteId={site?.id}
                  />
                )
              })}
            </div>
          )}

          {/* Dismissed issues (fixed / won't-fix / false-positive), collapsed by default */}
          {dismissedPatterns.length > 0 && (
            <div className="mt-6">
              <TierSection
                tier="dismissed"
                label={`Dismissed (${dismissedPatterns.length})`}
                color={{ text: '#57575A', dot: '#9CA3AF', hex: '#9CA3AF' }}
                patterns={dismissedPatterns}
                siteId={site?.id}
                defaultOpen={false}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
