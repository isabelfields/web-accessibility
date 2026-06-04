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
  if (score >= 90) return 'text-[#34d399]'
  if (score >= 70) return 'text-[#fbbf24]'
  return 'text-[#f87171]'
}

export function SiteCard({ site }: SiteCardProps) {
  const { latestScan } = site
  const pageCount = site.pages?.length ?? 0

  return (
    <Link
      href={`/sites/${site.id}`}
      className="block bg-[#141720] border border-[#252a38] rounded-xl p-5 hover:bg-[#1a1e2a] hover:border-[#2e3448] transition-all group"
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: name + meta */}
        <div className="min-w-0">
          <div className="font-bold text-[#eef0f6] text-sm leading-tight truncate">{site.name}</div>
          <div className="text-xs text-[#8892a4] mt-0.5">
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
            <div className="text-xs text-[#8892a4] mt-0.5 uppercase tracking-wider">Score</div>
          </div>
        ) : (
          <div className="text-center shrink-0">
            <div className="text-2xl font-bold text-[#5a6272]">—</div>
            <div className="text-xs text-[#8892a4] mt-0.5 uppercase tracking-wider">Score</div>
          </div>
        )}
      </div>

      {/* Stats row */}
      {latestScan ? (
        <>
          <div className="mt-4 flex items-center gap-4 text-xs">
            <span className="text-[#f87171] font-medium">
              {latestScan.raw_violation_count} violation{latestScan.raw_violation_count !== 1 ? 's' : ''}
            </span>
            <span className="text-[#8892a4]">
              {latestScan.unique_pattern_count} issue type{latestScan.unique_pattern_count !== 1 ? 's' : ''}
            </span>
            <span className="ml-auto text-[#5b9bd6] font-medium group-hover:underline">
              View →
            </span>
          </div>
          {/* Score bar */}
          <div className="mt-3 h-1 w-full bg-[#252a38] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                (latestScan.score ?? 0) >= 90 ? 'bg-[#34d399]' :
                (latestScan.score ?? 0) >= 70 ? 'bg-[#fbbf24]' : 'bg-[#f87171]'
              }`}
              style={{ width: `${Math.round(latestScan.score ?? 0)}%` }}
            />
          </div>
        </>
      ) : (
        <div className="mt-4 flex items-center justify-between text-xs">
          <span className="text-[#8892a4] italic">No scans yet</span>
          <span className="text-[#5b9bd6] font-medium group-hover:underline">View →</span>
        </div>
      )}
    </Link>
  )
}
