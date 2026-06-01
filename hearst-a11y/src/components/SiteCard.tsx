import Link from 'next/link'
import { ScoreGauge } from './ScoreGauge'

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
    pages: { url: string; label: string; templateType: string }[]
    created_at: string
    latestScan: LatestScan | null
  }
}

export function SiteCard({ site }: SiteCardProps) {
  const { latestScan } = site

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{site.name}</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {site.pages?.length ?? 0} page{(site.pages?.length ?? 0) !== 1 ? 's' : ''} configured
          </p>
        </div>
        {latestScan ? (
          <ScoreGauge score={latestScan.score ?? 0} size={100} />
        ) : (
          <div className="w-24 h-24 flex items-center justify-center rounded-full border-4 border-gray-200 text-gray-400 text-xs text-center">
            No scans yet
          </div>
        )}
      </div>

      {latestScan ? (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-gray-500 text-xs">Patterns</div>
            <div className="font-semibold text-gray-800">{latestScan.unique_pattern_count}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-gray-500 text-xs">Raw violations</div>
            <div className="font-semibold text-gray-800">{latestScan.raw_violation_count}</div>
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-400 italic">Run a scan to see accessibility data.</div>
      )}

      <Link
        href={`/sites/${site.id}`}
        className="mt-auto inline-flex items-center justify-center px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors"
      >
        View Details
      </Link>
    </div>
  )
}
