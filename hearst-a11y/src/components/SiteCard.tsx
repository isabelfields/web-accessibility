import Link from 'next/link'

interface LatestScan {
  score: number
  status: string
  started_at: string
  unique_pattern_count: number
  raw_violation_count: number
}

interface SiteCardProps {
  site: {
    id: string
    name: string
    division?: string
    pages: { url: string; label: string; templateType: string }[]
    created_at: string
    latestScan: LatestScan | null
  }
}

function scoreColor(score: number) {
  if (score >= 90) return 'text-green-600'
  if (score >= 80) return 'text-lime-600'
  if (score >= 70) return 'text-yellow-600'
  if (score >= 60) return 'text-orange-500'
  return 'text-red-500'
}

export function SiteCard({ site }: SiteCardProps) {
  const { latestScan } = site
  const pageCount = site.pages?.length ?? 0

  return (
    <Link
      href={`/sites/${site.id}`}
      className="block bg-white border border-gray-200 shadow-sm rounded-xl p-5 hover:shadow-md hover:border-gray-300 transition-all group"
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: name + meta */}
        <div className="min-w-0">
          <div className="font-semibold text-gray-900 text-sm leading-tight truncate">{site.name}</div>
          <div className="text-xs text-gray-400 mt-0.5">
            {pageCount} page{pageCount !== 1 ? 's' : ''}
            {site.division ? ` · ${site.division}` : ''}
          </div>
        </div>

        {/* Middle: score */}
        {latestScan ? (
          <div className="text-center shrink-0">
            <div className={`text-2xl font-bold leading-none ${scoreColor(latestScan.score ?? 0)}`}>
              {Math.round(latestScan.score ?? 0)}
            </div>
            <div className="text-xs text-gray-400 mt-0.5 uppercase tracking-wider">Score</div>
          </div>
        ) : (
          <div className="text-center shrink-0">
            <div className="text-2xl font-bold text-gray-300">—</div>
            <div className="text-xs text-gray-400 mt-0.5 uppercase tracking-wider">Score</div>
          </div>
        )}
      </div>

      {/* Stats row */}
      {latestScan ? (
        <>
          <div className="mt-4 flex items-center gap-4 text-xs">
            <span className="text-red-500 font-medium">
              {latestScan.raw_violation_count} violation{latestScan.raw_violation_count !== 1 ? 's' : ''}
            </span>
            <span className="text-gray-400">
              {latestScan.unique_pattern_count} issue type{latestScan.unique_pattern_count !== 1 ? 's' : ''}
            </span>
            <span className="ml-auto text-brand-500 font-medium group-hover:underline">
              View →
            </span>
          </div>
          {/* Score bar */}
          <div className="mt-3 h-1 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                (latestScan.score ?? 0) >= 90 ? 'bg-green-500' :
                (latestScan.score ?? 0) >= 70 ? 'bg-yellow-400' : 'bg-red-500'
              }`}
              style={{ width: `${Math.round(latestScan.score ?? 0)}%` }}
            />
          </div>
        </>
      ) : (
        <div className="mt-4 flex items-center justify-between text-xs">
          <span className="text-gray-400 italic">No scans yet</span>
          <span className="text-brand-500 font-medium group-hover:underline">View →</span>
        </div>
      )}
    </Link>
  )
}
