import { sql } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ScoreGauge } from '@/components/ScoreGauge'
import { ViolationCard } from '@/components/ViolationCard'
import { PageViolationsModal } from '@/components/PageViolationsModal'
import { DeleteScanButton } from '@/components/DeleteScanButton'
import type { ViolationPattern, PageScore } from '@/types'

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

function scoreColor(score: number) {
  if (score >= 90) return 'text-green-600'
  if (score >= 80) return 'text-lime-600'
  if (score >= 70) return 'text-yellow-600'
  if (score >= 60) return 'text-orange-500'
  return 'text-red-500'
}

function impactColor(impact: string) {
  switch (impact) {
    case 'critical': return 'bg-red-100 text-red-700 border-red-200'
    case 'serious': return 'bg-orange-100 text-orange-700 border-orange-200'
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

  const totalViolations = patterns.reduce((sum, p) => sum + p.occurrences, 0)

  return (
    <div className="p-8 max-w-5xl">
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
        <DeleteScanButton jobId={scan.id} />
      </div>

      {scan.status !== 'complete' ? (
        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-12 text-center text-gray-400">
          {scan.status === 'failed' ? `Scan failed: ${scan.error ?? 'Unknown error'}` :
           scan.status === 'running' ? 'Scan is still running…' :
           scan.status === 'cancelled' ? 'Scan was cancelled.' : scan.status}
        </div>
      ) : (
        <>
          {/* Score + Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col items-center justify-center">
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">WCAG AA Score</div>
              <div className={`text-5xl font-bold leading-none mt-2 ${scoreColor(scan.score ?? 0)}`}>
                {Math.round(scan.score ?? 0)}
              </div>
              <div className="text-xs text-gray-400 mt-2">0–100, higher is better</div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">Summary</div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Pages scanned</span>
                <span className="font-semibold">{scan.pages_scanned ?? 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total violations</span>
                <span className="font-semibold">{scan.raw_violation_count ?? 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Unique issue types</span>
                <span className="font-semibold">{scan.unique_pattern_count ?? 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Completed</span>
                <span className="font-semibold">{formatDate(scan.completed_at)}</span>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">By Severity</div>
              <div className="space-y-3">
                {(['critical', 'serious', 'moderate', 'minor'] as const).map(impact => {
                  const count = byImpact[impact].reduce((s, p) => s + p.occurrences, 0)
                  const barColor = impact === 'critical' ? 'bg-red-500' : impact === 'serious' ? 'bg-orange-400' : impact === 'moderate' ? 'bg-amber-400' : 'bg-blue-400'
                  const pct = totalViolations > 0 ? Math.round((count / totalViolations) * 100) : 0
                  return (
                    <div key={impact}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500 capitalize">{impact}</span>
                        <span className="font-semibold text-gray-700">{count}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Per-page scores */}
          {pageScores.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Page Scores</h2>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-600 font-medium">Page</th>
                      <th className="text-left px-4 py-3 text-gray-600 font-medium">URL</th>
                      <th className="text-right px-4 py-3 text-gray-600 font-medium">Score</th>
                      <th className="text-right px-4 py-3 text-gray-600 font-medium">Issues</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pageScores.map((ps, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{ps.label ?? '—'}</td>
                        <td className="px-4 py-3">
                          <PageViolationsModal pageScore={ps} patterns={patterns} />
                          {ps.error && (
                            <div className="text-xs text-red-500 mt-0.5 truncate max-w-xs" title={ps.error}>
                              ⚠ {ps.error.length > 80 ? ps.error.slice(0, 80) + '…' : ps.error}
                            </div>
                          )}
                        </td>
                        <td className={`px-4 py-3 text-right font-bold ${ps.score != null ? scoreColor(ps.score) : 'text-gray-400'}`}>
                          {ps.score != null ? ps.score : <span className="text-xs font-normal bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Failed</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">{ps.violationCount ?? '—'}</td>
                      </tr>
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
            <div className="space-y-8">
              {(['critical', 'serious', 'moderate', 'minor'] as const).map(impact => {
                const group = byImpact[impact]
                if (group.length === 0) return null
                const dotColor = impact === 'critical' ? 'bg-red-500' : impact === 'serious' ? 'bg-orange-400' : impact === 'moderate' ? 'bg-amber-400' : 'bg-blue-400'
                return (
                  <div key={impact}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                      <h3 className="text-sm font-semibold text-gray-700 capitalize">{impact}</h3>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                        {group.length} type{group.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="space-y-2">
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
