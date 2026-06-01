import { sql } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ScoreGauge } from '@/components/ScoreGauge'
import { TrendSparkline } from '@/components/TrendSparkline'
import { RunScanButton } from '@/components/RunScanButton'
import type { ViolationPattern, SitePage } from '@/types'

async function getSiteData(id: string) {
  const [site] = await sql`SELECT * FROM sites WHERE id = ${id}`
  if (!site) return null

  const scans = await sql`
    SELECT id, score, status, pages_scanned, raw_violation_count,
           unique_pattern_count, estimated_cost_usd, started_at, completed_at,
           triggered_by, patterns
    FROM scan_jobs
    WHERE site_id = ${id}
    ORDER BY started_at DESC
    LIMIT 20
  `

  return { site, scans }
}

function impactColor(impact: string) {
  switch (impact) {
    case 'critical': return 'bg-red-100 text-red-700 border-red-200'
    case 'serious': return 'bg-orange-100 text-orange-700 border-orange-200'
    case 'moderate': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    case 'minor': return 'bg-blue-100 text-blue-700 border-blue-200'
    default: return 'bg-gray-100 text-gray-600 border-gray-200'
  }
}

function formatDate(d: string | Date | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function scoreColor(score: number) {
  if (score >= 90) return 'text-green-600'
  if (score >= 80) return 'text-lime-600'
  if (score >= 70) return 'text-yellow-600'
  if (score >= 60) return 'text-orange-500'
  return 'text-red-500'
}

export default async function SiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await getSiteData(id)
  if (!data) notFound()

  const { site, scans } = data
  const pages: SitePage[] = (site.pages as SitePage[]) ?? []

  const completedScans = scans.filter((s: any) => s.status === 'complete')
  const latestScan = completedScans[0] ?? null
  const latestScore = latestScan?.score ?? 0
  const trendScores = completedScans.slice(0, 10).reverse().map((s: any) => s.score ?? 0)

  // Aggregate violation patterns from latest scan
  const patterns: ViolationPattern[] = latestScan?.patterns ?? []
  const byImpact: Record<string, ViolationPattern[]> = { critical: [], serious: [], moderate: [], minor: [] }
  for (const p of patterns) {
    if (byImpact[p.impact]) byImpact[p.impact].push(p)
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/sites" className="hover:text-gray-700">Sites</Link>
            <span>/</span>
            <span className="text-gray-800 font-medium">{site.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{site.name}</h1>
          {latestScan && (
            <p className="text-sm text-gray-500 mt-1">
              Last scanned {formatDate(latestScan.started_at)}
            </p>
          )}
        </div>
        <RunScanButton siteId={site.id} />
      </div>

      {/* Score + Trend */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col items-center">
          <div className="text-sm font-medium text-gray-500 mb-3">Accessibility Score</div>
          <ScoreGauge score={latestScore} size={160} />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="text-sm font-medium text-gray-500 mb-3">Score Trend</div>
          {trendScores.length >= 2 ? (
            <TrendSparkline scores={trendScores} width={240} height={80} />
          ) : (
            <div className="text-sm text-gray-400 italic">Run more scans to see trends.</div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="text-sm font-medium text-gray-500 mb-3">Latest Scan Stats</div>
          {latestScan ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Pages scanned</span>
                <span className="font-semibold">{latestScan.pages_scanned}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Raw violations</span>
                <span className="font-semibold">{latestScan.raw_violation_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Unique patterns</span>
                <span className="font-semibold">{latestScan.unique_pattern_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Est. cost</span>
                <span className="font-semibold">${(latestScan.estimated_cost_usd ?? 0).toFixed(4)}</span>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-400 italic">No completed scans yet.</div>
          )}
        </div>
      </div>

      {/* Tabs — static rendering with sections */}
      <div className="space-y-8">
        {/* Violations */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Violations</h2>
          {patterns.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-400">
              {latestScan ? 'No violations found. Great job!' : 'Run a scan to see violations.'}
            </div>
          ) : (
            <div className="space-y-6">
              {(['critical', 'serious', 'moderate', 'minor'] as const).map(impact => {
                const group = byImpact[impact]
                if (group.length === 0) return null
                return (
                  <div key={impact}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${impactColor(impact)}`}>
                        {impact.charAt(0).toUpperCase() + impact.slice(1)}
                      </span>
                      <span className="text-sm text-gray-500">{group.length} pattern{group.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="space-y-2">
                      {group.map(p => (
                        <div key={p.fingerprint} className="bg-white rounded-lg border border-gray-200 p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="font-mono text-sm text-gray-800 font-medium">{p.rule}</div>
                              <div className="text-sm text-gray-600 mt-1">{p.description}</div>
                              {p.fixSuggestion && (
                                <div className="mt-2 text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-2 border border-blue-100">
                                  <span className="font-medium">Fix: </span>{p.fixSuggestion}
                                </div>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-sm font-semibold text-gray-700">{p.occurrences} occurrence{p.occurrences !== 1 ? 's' : ''}</div>
                              <div className="text-xs text-gray-400">{p.affectedPages?.length ?? 0} page{(p.affectedPages?.length ?? 0) !== 1 ? 's' : ''}</div>
                            </div>
                          </div>
                        </div>
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
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Scan History</h2>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Started</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Status</th>
                  <th className="text-right px-4 py-3 text-gray-600 font-medium">Score</th>
                  <th className="text-right px-4 py-3 text-gray-600 font-medium">Pages</th>
                  <th className="text-right px-4 py-3 text-gray-600 font-medium">Patterns</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Triggered By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {scans.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-400">No scans yet.</td>
                  </tr>
                ) : (
                  scans.map((scan: any) => (
                    <tr key={scan.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700">{formatDate(scan.started_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          scan.status === 'complete' ? 'bg-green-100 text-green-700' :
                          scan.status === 'running' ? 'bg-blue-100 text-blue-700' :
                          scan.status === 'failed' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {scan.status}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${scan.score ? scoreColor(scan.score) : 'text-gray-400'}`}>
                        {scan.score ? Math.round(scan.score) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{scan.pages_scanned ?? 0}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{scan.unique_pattern_count ?? 0}</td>
                      <td className="px-4 py-3 text-gray-500 capitalize">{scan.triggered_by}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pages */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Configured Pages</h2>
          {pages.length === 0 ? (
            <div className="text-gray-400 italic text-sm">No pages configured.</div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Label</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">URL</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Template Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pages.map((page, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{page.label}</td>
                      <td className="px-4 py-3">
                        <a
                          href={page.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-500 hover:text-blue-700 truncate max-w-xs block"
                        >
                          {page.url}
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 capitalize">
                          {page.templateType}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
