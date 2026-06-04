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

  return (
    <div className="px-8 py-6">
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
        <div className="flex items-center gap-2">
          <EditSiteButton site={{ id: site.id, name: site.name, division: site.division, pages }} />
          <RunScanButton siteId={site.id} />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="rounded-xl border border-gray-200 shadow-sm bg-white p-5 flex flex-col items-center justify-center">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Priority</div>
          {worstTier ? (
            <>
              <div className={`text-2xl font-bold ${TIER_COLOR[worstTier].text}`}>{TIER_LABEL[worstTier]}</div>
              <div className="text-xs text-gray-400 mt-1">highest tier found</div>
            </>
          ) : (
            <div className="text-lg font-semibold text-green-600">{latestScan ? 'No issues' : 'No scans yet'}</div>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 shadow-sm bg-white p-5">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">WCAG Errors</div>
          <div className="text-3xl font-bold text-gray-900 tabular-nums">{latestScan?.raw_violation_count ?? '—'}</div>
          <div className="text-xs text-gray-400 mt-1">{latestScan?.unique_pattern_count ?? 0} issue types</div>
        </div>

        <div className="rounded-xl border border-gray-200 shadow-sm bg-white p-5">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Pages Scanned</div>
          <div className="text-3xl font-bold text-gray-900 tabular-nums">{latestScan?.pages_scanned ?? '—'}</div>
          <div className="text-xs text-gray-400 mt-1">{pages.length} configured</div>
        </div>

        <div className="rounded-xl border border-gray-200 shadow-sm bg-white p-5">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Total Scans</div>
          <div className="text-3xl font-bold text-gray-900 tabular-nums">{scans.length}</div>
          <div className="text-xs text-gray-400 mt-1">{completedScans.length} completed</div>
        </div>
      </div>

      <div className="space-y-8">
        {/* Violations */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">WCAG Errors</h2>
          {patterns.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-400">
              {latestScan ? 'No violations found. Great job!' : 'Run a scan to see violations.'}
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
        </div>

        {/* Scan History */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Scan History</h2>
          <div className="rounded-xl border border-gray-200 shadow-sm bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Started</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Status</th>
                  <th className="text-right px-4 py-3 text-gray-600 font-medium">Pages</th>
                  <th className="text-right px-4 py-3 text-gray-600 font-medium">Issues</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Triggered By</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {scans.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-400">No scans yet.</td>
                  </tr>
                ) : (
                  scans.map((scan: any) => (
                    <tr key={scan.id} className="hover:bg-gray-50 group relative cursor-pointer">
                      <td className="px-4 py-3 text-gray-700">
                        <Link href={`/scans/${scan.id}`} className="absolute inset-0" aria-label={`View scan from ${formatDate(scan.started_at)}`} />
                        {formatDate(scan.started_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          scan.status === 'complete' ? 'bg-green-100 text-green-700' :
                          scan.status === 'running' ? 'bg-blue-100 text-blue-700' :
                          scan.status === 'failed' ? 'bg-red-100 text-red-700' :
                          scan.status === 'cancelled' ? 'bg-gray-100 text-gray-500' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {scan.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{scan.pages_scanned ?? 0}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{scan.raw_violation_count ?? 0}</td>
                      <td className="px-4 py-3 text-gray-500 capitalize">{scan.triggered_by}</td>
                      <td className="px-4 py-3 text-right relative z-10">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Configured Pages</h2>
          {pages.length === 0 ? (
            <div className="text-gray-400 italic text-sm">No pages configured.</div>
          ) : (
            <div className="rounded-xl border border-gray-200 shadow-sm bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Label</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">URL</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Template Type</th>
                    <th className="text-right px-4 py-3 text-gray-600 font-medium">WCAG Errors</th>
                    <th className="text-right px-4 py-3 text-gray-600 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pages.map((page, i) => {
                    const ps = pageScores.find(s => s.url === page.url)
                    return (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{page.label}</td>
                        <td className="px-4 py-3">
                          <PageViolationsModal
                            pageScore={ps ?? { url: page.url, label: page.label, score: null as any, violationCount: null as any }}
                            patterns={patterns}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 capitalize">
                            {page.templateType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {ps ? (ps.violationCount ?? '—') : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {!ps
                            ? <span className="text-xs text-gray-300">—</span>
                            : ps.score == null
                              ? <span className="text-xs font-normal bg-red-50 text-red-500 px-2 py-0.5 rounded-md">Failed</span>
                              : <span className="text-xs text-gray-400">Scanned</span>
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
