import Link from 'next/link'

interface LatestScan {
  score: number
  status: string
  started_at: string
  unique_pattern_count: number
  raw_violation_count: number
  patterns?: { impact: string; occurrences: number }[]
}

interface SiteCardProps {
  site: {
    id: string
    name: string
    division?: string
    pages: { url: string; label: string; templateType: string }[]
    created_at: string
    latestScan: LatestScan | null
    prevScan?: { raw_violation_count: number } | null
  }
}

function worstTier(patterns: { impact: string }[] = []): string | null {
  if (patterns.some(p => p.impact === 'critical')) return 'T1'
  if (patterns.some(p => p.impact === 'serious'))  return 'T2'
  if (patterns.some(p => p.impact === 'moderate')) return 'T3'
  if (patterns.some(p => p.impact === 'minor'))    return 'T4'
  return null
}

const TIER_STYLE: Record<string, { text: string; bg: string }> = {
  T1: { text: 'text-red-700 dark:text-red-400',    bg: 'bg-red-100 dark:bg-red-500/15' },
  T2: { text: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-500/15' },
  T3: { text: 'text-amber-700 dark:text-amber-400',  bg: 'bg-amber-100 dark:bg-amber-500/15' },
  T4: { text: 'text-blue-700 dark:text-blue-400',   bg: 'bg-blue-100 dark:bg-blue-500/15' },
}

export function SiteCard({ site }: SiteCardProps) {
  const { latestScan, prevScan } = site
  const pageCount = site.pages?.length ?? 0
  const tier = latestScan ? worstTier(latestScan.patterns ?? []) : null

  const delta =
    latestScan && prevScan != null
      ? prevScan.raw_violation_count - latestScan.raw_violation_count
      : null

  return (
    <Link
      href={`/sites/${site.id}`}
      className="block card card-hover p-5 group"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="font-bold text-[var(--text)] text-[15px] leading-tight truncate">{site.name}</div>
          <div className="text-sm text-[var(--text-muted)] mt-1">
            {pageCount} page{pageCount !== 1 ? 's' : ''}
            {site.division ? ` · ${site.division}` : ''}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {delta !== null && delta !== 0 && (
            <span
              className={`text-xs font-semibold px-2 py-1 rounded-full ${
                delta > 0
                  ? 'text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-500/15'
                  : 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-500/15'
              }`}
              title={delta > 0 ? `${delta} fewer errors than last scan` : `${Math.abs(delta)} more errors than last scan`}
            >
              {delta > 0 ? `↓ ${delta}` : `↑ ${Math.abs(delta)}`}
            </span>
          )}
          {tier && (
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${TIER_STYLE[tier].text} ${TIER_STYLE[tier].bg}`}>
              {tier}
            </span>
          )}
        </div>
      </div>

      {latestScan ? (
        <div className="flex items-center justify-between">
          <div>
            <span className="text-2xl font-extrabold text-[var(--text)] tabular-nums leading-none">
              {latestScan.raw_violation_count}
            </span>
            <span className="text-sm text-[var(--text-muted)] ml-1.5">error{latestScan.raw_violation_count !== 1 ? 's' : ''}</span>
          </div>
          <div className="text-right">
            <span className="text-sm text-[var(--text-muted)]">
              {latestScan.unique_pattern_count} type{latestScan.unique_pattern_count !== 1 ? 's' : ''}
            </span>
          </div>
          <span className="text-[var(--text-subtle)] group-hover:text-[var(--accent)] transition-colors text-lg" aria-hidden="true">→</span>
        </div>
      ) : (
        <div className="text-sm text-[var(--text-subtle)] italic">No scans yet</div>
      )}
    </Link>
  )
}
