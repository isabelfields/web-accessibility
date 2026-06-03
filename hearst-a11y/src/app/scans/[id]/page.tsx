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

function impactColor(impact: string) {
  switch (impact) {
    case 'critical': return 'bg-red-100 text-red-700 border-red-200'
    case 'serious': return 'bg-red-100 text-red-700 border-red-200'
    case 'moderate': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    default: return 'bg-blue-100 text-blue-700 border-blue-200'
  }
}

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

  // Group into tiers for display
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
    <div className="px-8 py-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-gray-700">Dashboard</Link>
        <span>/</span>
        {site && (
          <>
            <Link href={`/sites/${site.id}`} className="hover:text-gray-700">{site.name}</Link>
            <span>/</span>
          </>
        )}
        <span className="text-gray-800 font-medium">Scan {formatDate(scan.started_at)}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {site?.name ?? scan.root_url}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{scan.root_url}</p>
          <div className="flex items-center gap-3 mt-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              scan.status === 'complete' ? 'bg-green-100 text-green-700' :
              scan.status === 'running' ? 'bg-blue-100 text-blue-700' :
              scan.status === 'failed' ? 'bg-red-100 text-red-700' :
              'bg-gray-100 text-gray-500'
            }`}>
              {scan.status}
            </span>
            <span className="text-sm text-gray-400">{formatDate(scan.started_at)}</span>
            {scan.triggered_by && (
              <span className="text-sm text-gray-400 capitalize">· {scan.triggered_by}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {scan.status === 'complete' && <ExportPdfButton scanId={scan.id} />}
          <DeleteScanButton jobId={scan.id} />
        </div>
      </div>

      {scan.status !== 'complete' ? (
        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-12 text-center text-gray-400">
          {scan.status === 'failed' ? `Scan failed: ${scan.error ?? 'Unknown error'}` :
           scan.status === 'running' ? 'Scan is still running…' :
           scan.status === 'cancelled' ? 'Scan was cancelled.' : scan.status}
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            {/* Priority tier */}
            <div className="rounded-xl border border-gray-200 shadow-sm bg-white p-6 flex flex-col items-center justify-center">
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Priority</div>
              {worstTier ? (
                <>
                  <div className={`text-2xl font-bold ${TIER_COLOR[worstTier].text}`}>{TIER_LABEL[worstTier]}</div>
                  <div className="text-xs text-gray-400 mt-1">highest tier found</div>
                </>
              ) : (
                <div className="text-lg font-semibold text-green-600">No issues</div>
              )}
            </div>

            {/* Violations summary */}
            <div className="rounded-xl border border-gray-200 shadow-sm bg-white p-6 flex flex-col justify-between">
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Violations</div>
              <div className="text-4xl font-bold text-gray-900 tabular-nums leading-none">{totalViolations}</div>
              <div className="mt-3 space-y-1.5 text-xs text-gray-400">
                <div className="flex justify-between"><span>Issue types</span><span className="font-semibold text-gray-600">{scan.unique_pattern_count ?? 0}</span></div>
                <div className="flex justify-between"><span>Pages scanned</span><span className="font-semibold text-gray-600">{scan.pages_scanned ?? 0}</span></div>
              </div>
            </div>

            {/* WCAG A / AA / AAA */}
            <div className="rounded-xl border border-gray-200 shadow-sm bg-white p-6">
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-4">By WCAG Level</div>
              <div className="flex items-end gap-5">
                <div>
                  <div className="text-2xl font-bold text-gray-900 tabular-nums">{wcagLevels.A}</div>
                  <div className="text-[11px] font-semibold text-gray-400 mt-0.5">Level A</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900 tabular-nums">{wcagLevels.AA}</div>
                  <div className="text-[11px] font-semibold text-gray-400 mt-0.5">Level AA</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900 tabular-nums">{wcagLevels.AAA}</div>
                  <div className="text-[11px] font-semibold text-gray-400 mt-0.5">Level AAA</div>
                </div>
              </div>
            </div>

            {/* Tier breakdown bar */}
            <div className="rounded-xl border border-gray-200 shadow-sm bg-white p-6">
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-4">By Tier</div>
              <SeverityBar counts={severityCounts} height="h-3" />
            </div>
          </div>

          {/* Per-page issues */}
          {pageScores.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Page Issues</h2>
              <div className="rounded-xl border border-gray-200 shadow-sm bg-white overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Page</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">URL</th>
                      <th className="text-right px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Violations</th>
                      <th className="text-right px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageScores.map((ps, i) => (
                      <PageViolationsModal key={i} pageScore={ps} patterns={patterns}>
                        <tr className={`border-t border-gray-100 transition-colors ${ps.score != null ? 'hover:bg-gray-50/70 cursor-pointer' : ''}`}>
                          <td className="px-4 py-3 font-medium text-gray-800">{ps.label ?? '—'}</td>
                          <td className="px-4 py-3">
                            <span className="text-brand-500 truncate block max-w-sm">{ps.url}</span>
                            {ps.error && (
                              <div className="text-xs text-red-500 mt-0.5 truncate max-w-sm" title={ps.error}>
                                ⚠ {ps.error.length > 80 ? ps.error.slice(0, 80) + '…' : ps.error}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600">{ps.violationCount ?? '—'}</td>
                          <td className="px-4 py-3 text-right">
                            {ps.score == null
                              ? <span className="text-xs font-normal bg-red-50 text-red-500 px-2 py-0.5 rounded-md">Failed</span>
                              : <span className="text-xs text-gray-400">Scanned</span>
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
            <h2 className="text-lg font-semibold text-gray-800">Issues Found</h2>
            <span className="text-sm text-gray-400">{patterns.length} issue type{patterns.length !== 1 ? 's' : ''} · {totalViolations} total</span>
          </div>
          {patterns.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center text-gray-400">
              No violations found — great job!
            </div>
          ) : (
            <div className="space-y-5">
              {(['tier1', 'tier2', 'tier3', 'tier4'] as const).map(tier => {
                const group = byTier[tier]
                if (group.length === 0) return null
                const c = TIER_COLOR[tier]
                return (
                  <div key={tier}>
                    <div className="flex items-center gap-2.5 mb-2.5 px-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                      <h3 className={`text-xs font-semibold uppercase tracking-wider ${c.text}`}>{TIER_LABEL[tier]}</h3>
                      <span className="text-xs text-gray-400 font-medium">{group.length} issue type{group.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="space-y-1.5">
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
