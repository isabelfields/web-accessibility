import { sql } from '@/lib/db'
import { SiteCard } from '@/components/SiteCard'

async function getData() {
  const [sites, recentScans, statsRow] = await Promise.all([
    sql`SELECT * FROM sites ORDER BY created_at DESC`.then(async (sites) => {
      return Promise.all(
        sites.map(async (site) => {
          const [latest] = await sql`
            SELECT score, status, started_at, unique_pattern_count, raw_violation_count
            FROM scan_jobs
            WHERE site_id = ${site.id} AND status = 'complete'
            ORDER BY started_at DESC LIMIT 1
          `
          return { ...site, latestScan: latest ?? null }
        })
      )
    }),
    sql`
      SELECT sj.id, sj.root_url, s.name as site_name, sj.status, sj.score,
             sj.pages_scanned, sj.raw_violation_count, sj.unique_pattern_count,
             sj.started_at, sj.completed_at, sj.triggered_by
      FROM scan_jobs sj
      LEFT JOIN sites s ON s.id = sj.site_id
      ORDER BY sj.started_at DESC
      LIMIT 10
    `,
    sql`
      SELECT
        COUNT(DISTINCT s.id) AS total_sites,
        ROUND(AVG(latest.score)::numeric, 1) AS avg_score,
        COUNT(CASE WHEN sj.started_at >= NOW() - INTERVAL '30 days' THEN 1 END) AS scans_this_month
      FROM sites s
      LEFT JOIN LATERAL (
        SELECT score FROM scan_jobs WHERE site_id = s.id AND status = 'complete' ORDER BY started_at DESC LIMIT 1
      ) latest ON true
      LEFT JOIN scan_jobs sj ON sj.site_id = s.id
    `.catch(() => [{ total_sites: 0, avg_score: null, scans_this_month: 0 }]),
  ])

  return { sites, recentScans, stats: statsRow[0] ?? { total_sites: 0, avg_score: null, scans_this_month: 0 } }
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

export default async function DashboardPage() {
  const { sites, recentScans, stats } = await getData()

  const avgScore = stats.avg_score ? Number(stats.avg_score) : null

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Accessibility Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Hearst property accessibility at a glance</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="text-sm text-gray-500">Total Sites</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{stats.total_sites ?? 0}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="text-sm text-gray-500">Avg Score</div>
          <div className={`text-3xl font-bold mt-1 ${avgScore !== null ? scoreColor(avgScore) : 'text-gray-400'}`}>
            {avgScore !== null ? Math.round(avgScore) : '—'}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="text-sm text-gray-500">Scans This Month</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{stats.scans_this_month ?? 0}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="text-sm text-gray-500">Sites Monitored</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{sites.length}</div>
        </div>
      </div>

      {/* Site cards */}
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Sites</h2>
      {sites.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center text-gray-400">
          No sites yet. <a href="/sites" className="text-brand-500 underline">Add your first site</a>.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-10">
          {sites.map((site: any) => (
            <SiteCard key={site.id} site={site} />
          ))}
        </div>
      )}

      {/* Recent scans */}
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent Scans</h2>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Site / URL</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Status</th>
              <th className="text-right px-4 py-3 text-gray-600 font-medium">Score</th>
              <th className="text-right px-4 py-3 text-gray-600 font-medium">Pages</th>
              <th className="text-right px-4 py-3 text-gray-600 font-medium">Started</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {recentScans.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-400">No scans yet.</td>
              </tr>
            ) : (
              recentScans.map((scan: any) => (
                <tr key={scan.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{scan.site_name ?? scan.root_url}</div>
                    {scan.site_name && <div className="text-xs text-gray-400 truncate max-w-xs">{scan.root_url}</div>}
                  </td>
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
                  <td className="px-4 py-3 text-right text-gray-500">{formatDate(scan.started_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
