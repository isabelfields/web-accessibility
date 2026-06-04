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

export function SiteCard({ site }: SiteCardProps) {
  const { latestScan } = site
  const pageCount = site.pages?.length ?? 0

  return (
    <Link
      href={`/sites/${site.id}`}
      className="block bg-[#11111a] border border-[#1e1e2a] rounded-lg p-4 hover:bg-[#14141e] hover:border-[#26263a] transition-all group"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="font-semibold text-white text-sm leading-tight truncate">{site.name}</div>
          <div className="text-xs text-white/70 mt-0.5">
            {pageCount} page{pageCount !== 1 ? 's' : ''}
            {site.division ? ` · ${site.division}` : ''}
          </div>
        </div>
        <span className="text-xs text-white/70 group-hover:text-white transition-colors shrink-0 mt-0.5">→</span>
      </div>

      {latestScan ? (
        <>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-red-400 font-medium">
              {latestScan.raw_violation_count} error{latestScan.raw_violation_count !== 1 ? 's' : ''}
            </span>
            <span className="text-white/70">
              {latestScan.unique_pattern_count} type{latestScan.unique_pattern_count !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="mt-2.5 h-px w-full bg-[#1e1e2a] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                latestScan.raw_violation_count === 0 ? 'bg-emerald-500' :
                latestScan.raw_violation_count < 10 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(100, (latestScan.raw_violation_count / 50) * 100)}%` }}
            />
          </div>
        </>
      ) : (
        <div className="text-xs text-white/70 italic">No scans yet</div>
      )}
    </Link>
  )
}
