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
  T1: { text: 'text-red-400',    bg: 'bg-red-500/15' },
  T2: { text: 'text-orange-400', bg: 'bg-orange-500/15' },
  T3: { text: 'text-amber-400',  bg: 'bg-amber-500/15' },
  T4: { text: 'text-blue-400',   bg: 'bg-blue-500/15' },
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
      className="block bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4 hover:bg-[var(--bg-elevated)] hover:border-[var(--border-strong)] transition-all group"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="font-semibold text-[var(--text)] text-sm leading-tight truncate">{site.name}</div>
          <div className="text-xs text-[var(--text-muted)] mt-0.5">
            {pageCount} page{pageCount !== 1 ? 's' : ''}
            {site.division ? ` · ${site.division}` : ''}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {delta !== null && delta !== 0 && (
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                delta > 0
                  ? 'text-emerald-400 bg-emerald-500/15'
                  : 'text-red-400 bg-red-500/15'
              }`}
              title={delta > 0 ? `${delta} fewer errors than last scan` : `${Math.abs(delta)} more errors than last scan`}
            >
              {delta > 0 ? `↓ ${delta}` : `↑ ${Math.abs(delta)}`}
            </span>
          )}
          {tier && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${TIER_STYLE[tier].text} ${TIER_STYLE[tier].bg}`}>
              {tier}
            </span>
          )}
        </div>
      </div>

      {latestScan ? (
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--text)] font-medium">
            {latestScan.raw_violation_count} error{latestScan.raw_violation_count !== 1 ? 's' : ''}
          </span>
          <span className="text-[var(--text-muted)]">
            {latestScan.unique_pattern_count} type{latestScan.unique_pattern_count !== 1 ? 's' : ''}
          </span>
          <span className="text-[var(--text-subtle)] group-hover:text-[var(--text-muted)] transition-colors" aria-hidden="true">→</span>
        </div>
      ) : (
        <div className="text-xs text-[var(--text-subtle)] italic">No scans yet</div>
      )}
    </Link>
  )
}
