import { sql } from '@/lib/db'
import Link from 'next/link'
import { Suspense } from 'react'
import { SiteCard } from '@/components/SiteCard'
import { DeleteScanButton } from '@/components/DeleteScanButton'
import { DivisionFilter } from '@/components/DivisionFilter'

export const dynamic = 'force-dynamic'

async function getData(division?: string) {
  const [allSites, recentScans, resolvedRow] = await Promise.all([
    sql`SELECT * FROM sites ORDER BY created_at DESC`.then(async (sites) => {
      return Promise.all(
        sites.map(async (site) => {
          const [latest] = await sql`
            SELECT score, status, started_at, unique_pattern_count, raw_violation_count
            FROM scan_jobs
            WHERE site_id = ${site.id} AND status = 'complete'
            ORDER BY started_at DESC LIMIT 1
          `
          const [prev] = await sql`
            SELECT raw_violation_count FROM scan_jobs
            WHERE site_id = ${site.id} AND status = 'complete'
            ORDER BY started_at DESC LIMIT 1 OFFSET 1
          `
          return { ...site, latestScan: latest ?? null, prevScan: prev ?? null }
        })
      )
    }),
    sql`
      SELECT sj.id, sj.root_url, s.name as site_name, s.division,
             sj.status, sj.score, sj.pages_scanned, sj.raw_violation_count,
             sj.started_at, sj.triggered_by
      FROM scan_jobs sj
      LEFT JOIN sites s ON s.id = sj.site_id
      ORDER BY sj.started_at DESC
      LIMIT 20
    `,
    // Errors resolved: sum of positive reductions between latest and previous scan per site
    sql`
      SELECT COALESCE(SUM(GREATEST(0, prev.raw_violation_count - latest.raw_violation_count)), 0) AS resolved
      FROM (
        SELECT DISTINCT ON (site_id) site_id, raw_violation_count
        FROM scan_jobs WHERE status = 'complete'
        ORDER BY site_id, started_at DESC
      ) latest
      JOIN (
        SELECT site_id, raw_violation_count,
               ROW_NUMBER() OVER (PARTITION BY site_id ORDER BY started_at DESC) AS rn
        FROM scan_jobs WHERE status = 'complete'
      ) prev ON prev.site_id = latest.site_id AND prev.rn = 2
    `.catch(() => [{ resolved: 0 }]),
  ])

  const activeDivisions = [...new Set(
    allSites.map((s: any) => s.division).filter(Boolean)
  )] as string[]

  const sites = division
    ? allSites.filter((s: any) => s.division === division)
    : allSites

  const scans = division
    ? recentScans.filter((s: any) => s.division === division)
    : recentScans

  // Compute stats from filtered sites
  const filteredScores = sites
    .map((s: any) => s.latestScan?.score)
    .filter((sc: any) => sc != null) as number[]
  const avgScore = filteredScores.length
    ? Math.round(filteredScores.reduce((a, b) => a + b, 0) / filteredScores.length)
    : null

  const totalPages = sites.reduce((sum: number, s: any) =>
    sum + (Array.isArray(s.pages) ? s.pages.length : 0), 0)

  const totalErrors = sites.reduce((sum: number, s: any) =>
    sum + (s.latestScan?.raw_violation_count ?? 0), 0)

  // Errors resolved: per-site diff, filtered by division
  const errorsResolved = sites.reduce((sum: number, s: any) => {
    const latest = s.latestScan?.raw_violation_count ?? 0
    const prev = s.prevScan?.raw_violation_count ?? latest
    return sum + Math.max(0, prev - latest)
  }, 0)

  return {
    sites,
    scans,
    activeDivisions,
    stats: { avgScore, totalPages, totalErrors, errorsResolved },
  }
}

function formatDate(d: string | Date | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function scoreColor(score: number) {
  if (score >= 90) return 'text-green-600'
  if (score >= 80) return 'text-lime-600'
  if (score >= 70) return 'text-yellow-600'
  if (score >= 60) return 'text-orange-500'
  return 'text-red-500'
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ division?: string }>
}) {
  const { division } = await searchParams
  const { sites, scans, activeDivisions, stats } = await getData(division)
  const showDivisionCol = !division

  const scansThisMonth = scans.filter((s: any) => new Date(s.started_at) > new Date(Date.now() - 30*24*60*60*1000)).length

  return (
    <div className="px-8 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Accessibility Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {division ? `${division} division` : 'All Hearst properties'}
          </p>
        </div>
        {activeDivisions.length > 0 && (
          <Suspense>
            <DivisionFilter activeDivisions={activeDivisions} />
          </Suspense>
        )}
      </div>

      {/* Stats — single row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-7">
        {/* Sites */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Sites</span>
            <svg className="w-3.5 h-3.5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/></svg>
          </div>
          <div className="text-2xl font-bold text-gray-900 tabular-nums">{sites.length}</div>
        </div>
        {/* Pages */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Pages</span>
            <svg className="w-3.5 h-3.5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          </div>
          <div className="text-2xl font-bold text-gray-900 tabular-nums">{stats.totalPages}</div>
        </div>
        {/* Avg Score */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Avg Score</span>
            <svg className="w-3.5 h-3.5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
          </div>
          <div className={`text-2xl font-bold tabular-nums ${stats.avgScore !== null ? scoreColor(stats.avgScore) : 'text-gray-300'}`}>
            {stats.avgScore !== null ? stats.avgScore : '—'}
          </div>
        </div>
        {/* Errors Caught */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Errors</span>
            <svg className="w-3.5 h-3.5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          </div>
          <div className="text-2xl font-bold text-red-500 tabular-nums">{stats.totalErrors}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">latest scans</div>
        </div>
        {/* Errors Resolved */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Resolved</span>
            <svg className="w-3.5 h-3.5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <div className="text-2xl font-bold text-green-600 tabular-nums">{stats.errorsResolved}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">vs prev scan</div>
        </div>
        {/* Scans */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Scans</span>
            <svg className="w-3.5 h-3.5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <div className="text-2xl font-bold text-gray-900 tabular-nums">{scansThisMonth}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">this month</div>
        </div>
      </div>

      {/* Site cards */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Sites</h2>
      </div>
      {sites.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center text-gray-400">
          {division ? `No sites in ${division} yet.` : 'No sites yet.'}{' '}
          <a href="/sites" className="text-brand-500 underline">Add a site</a>.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-7">
          {sites.map((site: any) => (
            <SiteCard key={site.id} site={site} />
          ))}
        </div>
      )}

      {/* Recent scans */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Recent Scans</h2>
      <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50/80">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Site / URL</th>
              {showDivisionCol && (
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Division</th>
              )}
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Score</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Pages</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Violations</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Started</th>
              <th className="px-2 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {scans.length === 0 ? (
              <tr>
                <td colSpan={showDivisionCol ? 8 : 7} className="text-center py-8 text-gray-400">
                  No scans yet.
                </td>
              </tr>
            ) : (
              scans.map((scan: any) => (
                <tr key={scan.id} className="border-t border-gray-100 hover:bg-gray-50/50 transition-colors group cursor-pointer relative">
                  <td className="px-4 py-2.5">
                    <Link href={`/scans/${scan.id}`} className="absolute inset-0" aria-label={`View scan for ${scan.site_name ?? scan.root_url}`} />
                    <div className="font-medium text-brand-500 text-sm">{scan.site_name ?? scan.root_url}</div>
                    {scan.site_name && <div className="text-xs text-gray-400 truncate max-w-xs">{scan.root_url}</div>}
                  </td>
                  {showDivisionCol && (
                    <td className="px-4 py-3 text-gray-500">
                      {scan.division ?? <span className="text-gray-300">—</span>}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        scan.status === 'complete' ? 'bg-green-500' :
                        scan.status === 'running' ? 'bg-blue-400' :
                        scan.status === 'failed' ? 'bg-red-500' :
                        'bg-gray-300'
                      }`} />
                      <span className="text-xs text-gray-600 capitalize">{scan.status}</span>
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold ${scan.score ? scoreColor(scan.score) : 'text-gray-400'}`}>
                    {scan.score ? Math.round(scan.score) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{scan.pages_scanned ?? 0}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{scan.raw_violation_count ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{formatDate(scan.started_at)}</td>
                  <td className="px-2 py-3 text-right relative z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DeleteScanButton jobId={scan.id} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
