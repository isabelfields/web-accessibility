import Link from 'next/link'
import type { ViolationPattern } from '@/types'
import { patternsToWorstTier, TIER_LABEL, TIER_COLOR } from '@/lib/tiers'

interface LatestScan {
  status: string
  started_at: string
  unique_pattern_count: number
  raw_violation_count: number
  patterns?: ViolationPattern[] | null
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
  const tier = latestScan?.patterns ? patternsToWorstTier(latestScan.patterns) : null

  return (
    <Link
      href={`/sites/${site.id}`}
      className="block bg-white border border-gray-200 shadow-sm rounded-xl p-5 hover:shadow-md hover:border-gray-300 transition-all group"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="font-semibold text-gray-900 text-sm leading-tight truncate">{site.name}</div>
          <div className="text-xs text-gray-400 mt-0.5">
            {pageCount} page{pageCount !== 1 ? 's' : ''}
            {site.division ? ` · ${site.division}` : ''}
          </div>
        </div>

        {tier ? (
          <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${TIER_COLOR[tier].bg} ${TIER_COLOR[tier].text} ring-1 ring-inset ${TIER_COLOR[tier].border}`}>
            {TIER_LABEL[tier]}
          </span>
        ) : latestScan ? (
          <span className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-50 text-green-600 ring-1 ring-inset ring-green-200">
            No issues
          </span>
        ) : null}
      </div>

      {latestScan ? (
        <div className="mt-4 flex items-center gap-4 text-xs">
          <span className="text-gray-600 font-medium">
            {latestScan.raw_violation_count} violation{latestScan.raw_violation_count !== 1 ? 's' : ''}
          </span>
          <span className="text-gray-400">
            {latestScan.unique_pattern_count} issue type{latestScan.unique_pattern_count !== 1 ? 's' : ''}
          </span>
          <span className="ml-auto text-brand-500 font-medium group-hover:underline">
            View →
          </span>
        </div>
      ) : (
        <div className="mt-4 flex items-center justify-between text-xs">
          <span className="text-gray-400 italic">No scans yet</span>
          <span className="text-brand-500 font-medium group-hover:underline">View →</span>
        </div>
      )}
    </Link>
  )
}
