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
import { countComponentsWithIssues, countIssueTypes, countOccurrences, formatSignedDelta, getSeverityCounts, isActiveWcagPattern, isWcagPattern, pluralize } from '@/lib/metrics'
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

function getRuleIssueCounts(patterns: ViolationPattern[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const pattern of patterns) {
    if (!isWcagPattern(pattern)) continue
    counts.set(pattern.rule, (counts.get(pattern.rule) ?? 0) + pattern.occurrences)
  }
  return counts
}

function getRuleDeltas(current: ViolationPattern[], previous: ViolationPattern[]) {
  const currentCounts = getRuleIssueCounts(current)
  const previousCounts = getRuleIssueCounts(previous)
  const rules = new Set([...currentCounts.keys(), ...previousCounts.keys()])
  return [...rules].map(rule => {
    const currentCount = currentCounts.get(rule) ?? 0
    const previousCount = previousCounts.get(rule) ?? 0
    return { rule, currentCount, previousCount, delta: currentCount - previousCount }
  })
}

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
  const activeWcagPatterns = activePatterns.filter(isWcagPattern)
  const dismissedWcagPatterns = patterns.filter(p => isWcagPattern(p) && (p.triageStatus ?? 'open') !== 'open')

  // Diff against the previous completed scan of this site.
  const prevPatterns: ViolationPattern[] = prevScan?.patterns ?? []
  const wcagPatterns = patterns.filter(isWcagPattern)
  const prevWcagPatterns = prevPatterns.filter(isWcagPattern)
  const prevFingerprints = new Set(prevWcagPatterns.map(p => p.fingerprint))
  const currentFingerprints = new Set(wcagPatterns.map(p => p.fingerprint))
  for (const p of patterns) p.isNew = prevScan && isWcagPattern(p) ? !prevFingerprints.has(p.fingerprint) : false
  const newPatterns = wcagPatterns.filter(p => p.isNew)
  const resolvedPatterns = prevWcagPatterns.filter(p => !currentFingerprints.has(p.fingerprint))
  const carriedOver = wcagPatterns.length - newPatterns.length
  const prevTotal = countOccurrences(prevWcagPatterns)
  const currentTotal = countOccurrences(wcagPatterns)
  const errorDelta = currentTotal - prevTotal
  const prevComponentTotal = countComponentsWithIssues(prevWcagPatterns, isWcagPattern)
  const currentComponentTotal = countComponentsWithIssues(wcagPatterns, isWcagPattern)
  const componentDelta = currentComponentTotal - prevComponentTotal
  const prevIssueTypeTotal = countIssueTypes(prevWcagPatterns)
  const currentIssueTypeTotal = countIssueTypes(wcagPatterns)
  const issueTypeDelta = currentIssueTypeTotal - prevIssueTypeTotal
  const ruleDeltas = prevScan ? getRuleDeltas(wcagPatterns, prevWcagPatterns) : []
  const biggestIncreases = ruleDeltas.filter(item => item.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 4)
  const biggestDecreases = ruleDeltas.filter(item => item.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 4)
  const hasMoreErrors = prevScan != null && errorDelta > 0
  const hasFewerErrors = prevScan != null && errorDelta < 0
  const currentErrorLabel = pluralize(currentTotal, 'issue')

  const byImpact: Record<string, ViolationPattern[]> = { critical: [], serious: [], moderate: [], minor: [] }
  for (const p of activeWcagPatterns) {
    if (byImpact[p.impact]) byImpact[p.impact].push(p)
  }

  // Group into tiers for display
  const byTier = {
    tier1: byImpact.critical,
    tier2: byImpact.serious,
    tier3: byImpact.moderate,
    tier4: byImpact.minor,
  }

  // Active WCAG totals and issue lists exclude best-practice-only findings and
  // triaged patterns (fixed/won't-fix/false-positive).
  const totalViolations = countOccurrences(activeWcagPatterns)
  const activeComponentsWithIssues = countComponentsWithIssues(activeWcagPatterns)
  const activeIssueTypes = countIssueTypes(activeWcagPatterns)
  const worstTier = patternsToWorstTier(activeWcagPatterns)

  const severityCounts = getSeverityCounts(activeWcagPatterns)

  const wcagLevels = { A: 0, AA: 0 }
  for (const p of patterns) {
    if (!isActiveWcagPattern(p)) continue
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
                  {currentTotal} {currentErrorLabel} ({formatSignedDelta(errorDelta)} since last scan)
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
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
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

            {/* Issues summary */}
            <div className="rounded-lg bg-white border border-[#E5E5EA] p-6 flex flex-col justify-between">
              <div className="text-[11px] font-semibold text-[#3A3A3C] uppercase tracking-wider mb-3">Total Issues</div>
              <div className="text-4xl font-bold text-[#1D1D1F] tabular-nums leading-none">{totalViolations}</div>
              <div className="mt-3 space-y-1.5 text-xs text-[#3A3A3C]">
                <div className="flex justify-between"><span>Components</span><span className="font-semibold text-[#1D1D1F]">{activeComponentsWithIssues}</span></div>
                <div className="flex justify-between"><span>Issue types</span><span className="font-semibold text-[#1D1D1F]">{activeIssueTypes}</span></div>
                <div className="flex justify-between"><span>Pages scanned</span><span className="font-semibold text-[#1D1D1F]">{scan.pages_scanned ?? 0}</span></div>
              </div>
            </div>

            {/* Components with issues */}
            <div className="rounded-lg bg-white border border-[#E5E5EA] p-6 flex flex-col justify-between">
              <div className="text-[11px] font-semibold text-[#3A3A3C] uppercase tracking-wider mb-3">Components with Issues</div>
              <div className="text-4xl font-bold text-[#1D1D1F] tabular-nums leading-none">{activeComponentsWithIssues}</div>
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

          {/* What changed since last scan */}
          {prevScan && (
            <div className="mb-8 rounded-lg bg-white border border-[#E5E5EA] p-5">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="text-[11px] font-semibold text-[#3A3A3C] uppercase tracking-wider">What changed since last scan</div>
                  <div className="text-xs text-[#3A3A3C] mt-1">Compared with {formatDateTime(prevScan.started_at)}</div>
                </div>
                <div className={`text-xs font-semibold px-2 py-1 rounded-full ${errorDelta > 0 ? 'bg-red-100 text-red-700' : errorDelta < 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-[#F5F5F7] text-[#3A3A3C]'}`}>
                  {errorDelta === 0 ? 'No total issue change' : `${formatSignedDelta(errorDelta)} total issues`}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
                <div className="rounded-lg border border-[#E5E5EA] bg-[#F9F9FB] p-3">
                  <div className="text-[11px] font-semibold text-[#3A3A3C] uppercase tracking-wider">Total Issues</div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-[#1D1D1F] tabular-nums">{currentTotal}</span>
                    <span className={`text-xs font-semibold ${errorDelta > 0 ? 'text-red-600' : errorDelta < 0 ? 'text-emerald-600' : 'text-[#3A3A3C]'}`}>{formatSignedDelta(errorDelta)}</span>
                  </div>
                  <div className="text-xs text-[#3A3A3C] mt-1">was {prevTotal}</div>
                </div>
                <div className="rounded-lg border border-[#E5E5EA] bg-[#F9F9FB] p-3">
                  <div className="text-[11px] font-semibold text-[#3A3A3C] uppercase tracking-wider">Components with Issues</div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-[#1D1D1F] tabular-nums">{currentComponentTotal}</span>
                    <span className={`text-xs font-semibold ${componentDelta > 0 ? 'text-red-600' : componentDelta < 0 ? 'text-emerald-600' : 'text-[#3A3A3C]'}`}>{formatSignedDelta(componentDelta)}</span>
                  </div>
                  <div className="text-xs text-[#3A3A3C] mt-1">was {prevComponentTotal}</div>
                </div>
                <div className="rounded-lg border border-[#E5E5EA] bg-[#F9F9FB] p-3">
                  <div className="text-[11px] font-semibold text-[#3A3A3C] uppercase tracking-wider">Issue Types</div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-[#1D1D1F] tabular-nums">{currentIssueTypeTotal}</span>
                    <span className={`text-xs font-semibold ${issueTypeDelta > 0 ? 'text-red-600' : issueTypeDelta < 0 ? 'text-emerald-600' : 'text-[#3A3A3C]'}`}>{formatSignedDelta(issueTypeDelta)}</span>
                  </div>
                  <div className="text-xs text-[#3A3A3C] mt-1">was {prevIssueTypeTotal}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-6 text-sm mb-4">
                <div><span className="text-lg font-bold text-red-600 tabular-nums">{newPatterns.length}</span> <span className="text-[#3A3A3C]">new issue type{newPatterns.length !== 1 ? 's' : ''}</span></div>
                <div><span className="text-lg font-bold text-emerald-600 tabular-nums">{resolvedPatterns.length}</span> <span className="text-[#3A3A3C]">resolved issue type{resolvedPatterns.length !== 1 ? 's' : ''}</span></div>
                <div><span className="text-lg font-bold text-[#1D1D1F] tabular-nums">{carriedOver}</span> <span className="text-[#3A3A3C]">carried over</span></div>
              </div>

              {(newPatterns.length > 0 || resolvedPatterns.length > 0 || biggestIncreases.length > 0 || biggestDecreases.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-4 border-t border-[#F0F0F0]">
                  <div>
                    <div className="text-xs font-semibold text-[#57575A] mb-2">Biggest increases</div>
                    {biggestIncreases.length > 0 ? (
                      <div className="space-y-1.5">
                        {biggestIncreases.map(item => (
                          <div key={item.rule} className="flex justify-between gap-3 text-xs">
                            <span className="font-medium text-[#1D1D1F] truncate">{item.rule}</span>
                            <span className="text-red-600 font-semibold tabular-nums">+{item.delta}</span>
                          </div>
                        ))}
                      </div>
                    ) : <div className="text-xs text-[#3A3A3C]">No rule counts increased.</div>}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[#57575A] mb-2">Biggest improvements</div>
                    {biggestDecreases.length > 0 ? (
                      <div className="space-y-1.5">
                        {biggestDecreases.map(item => (
                          <div key={item.rule} className="flex justify-between gap-3 text-xs">
                            <span className="font-medium text-[#1D1D1F] truncate">{item.rule}</span>
                            <span className="text-emerald-600 font-semibold tabular-nums">{item.delta}</span>
                          </div>
                        ))}
                      </div>
                    ) : <div className="text-xs text-[#3A3A3C]">No rule counts decreased.</div>}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[#57575A] mb-2">New issue types</div>
                    {newPatterns.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {newPatterns.slice(0, 8).map(p => <span key={p.fingerprint} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-red-50 text-red-700">{p.rule}</span>)}
                      </div>
                    ) : <div className="text-xs text-[#3A3A3C]">No new issue types.</div>}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[#57575A] mb-2">Resolved issue types</div>
                    {resolvedPatterns.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {resolvedPatterns.slice(0, 8).map(p => <span key={p.fingerprint} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700">{p.rule}</span>)}
                      </div>
                    ) : <div className="text-xs text-[#3A3A3C]">No issue types resolved.</div>}
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
                      <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#3A3A3C] uppercase tracking-wider">Total Issues</th>
                      <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#3A3A3C] uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageScores.map((ps, i) => {
                      const pageIssueCount = countPageWcagIssues(ps.url, patterns)
                      return (
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
                            <td className="px-4 py-3 text-right text-[#1D1D1F]">{ps.score == null ? '—' : pageIssueCount}</td>
                            <td className="px-4 py-3 text-right">
                              {ps.score == null
                                ? <span className="text-xs font-normal bg-red-100 text-red-700 px-2 py-0.5 rounded-md">Failed</span>
                                : <span className="text-xs text-[#3A3A3C]">Scanned</span>
                              }
                            </td>
                          </tr>
                        </PageViolationsModal>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Violations */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[#1D1D1F]">Component Issues Found</h2>
            <span className="text-sm text-[#3A3A3C]">{activeIssueTypes} issue type{activeIssueTypes !== 1 ? 's' : ''} · {totalViolations} component instance{totalViolations !== 1 ? 's' : ''}</span>
          </div>
          {activeWcagPatterns.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-[#E5E5EA] p-12 text-center text-[#3A3A3C]">
              {dismissedWcagPatterns.length > 0 ? 'No active component issues — all WCAG issues have been dismissed.' : 'No WCAG component issues found — great job!'}
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
          {dismissedWcagPatterns.length > 0 && (
            <div className="mt-6">
              <TierSection
                tier="dismissed"
                label={`Dismissed (${dismissedWcagPatterns.length})`}
                color={{ text: '#57575A', dot: '#9CA3AF', hex: '#9CA3AF' }}
                patterns={dismissedWcagPatterns}
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
