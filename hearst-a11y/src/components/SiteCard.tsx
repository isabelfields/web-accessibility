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

const TIER_ACCENT: Record<string, string> = {
  tier1: 'bg-red-500',
  tier2: 'bg-orange-500',
  tier3: 'bg-amber-400',
  tier4: 'bg-blue-400',
}

export function SiteCard({ site }: SiteCardProps) {
  const { latestScan } = site
  const pageCount = site.pages?.length ?? 0
  const tier = latestScan?.patterns ? patternsToWorstTier(latestScan.patterns) : null
  const accentColor = tier ? TIER_ACCENT[tier] : latestScan ? 'bg-green-500' : 'bg-gray-200'

  return (
    <Link
      href={`/sites/${site.id}`}
      className="block bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all group"
    >
      <div className={`h-1 ${accentColor}`} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="font-bold text-gray-900 text-sm leading-tight truncate">{site.name}</div>
            <div className="text-xs text-gray-400 mt-0.5">
              {pageCount} page{pageCount !== 1 ? 's' : ''}
              {site.division ? ` · ${site.division}` : ''}
            </div>
          </div>
          {tier ? (
            <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide ${TIER_COLOR[tier].bg} ${TIER_COLOR[tier].text}`}>
              {TIER_LABEL[tier]}
            </span>
          ) : latestScan ? (
            <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide bg-green-50 text-green-600">
              Clean
            </span>
          ) : null}
        </div>

        {latestScan ? (
          <div className="flex items-center justify-between">
            <div>
              <span className="text-2xl font-bold text-gray-900 tabular-nums leading-none">{latestScan.raw_violation_count}</span>
              <span className="text-xs text-gray-400 ml-1.5">errors</span>
            </div>
            <span className="text-xs text-brand-500 font-semibold group-hover:underline">View →</span>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 italic">No scans yet</span>
            <span className="text-xs text-brand-500 font-semibold group-hover:underline">View →</span>
          </div>
        )}
      </div>
    </Link>
  )
}
