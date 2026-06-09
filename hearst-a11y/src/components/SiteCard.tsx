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

function worstTier(patterns: { impact: string }[] = []): 't1' | 't2' | 't3' | 't4' | null {
  if (patterns.some(p => p.impact === 'critical')) return 't1'
  if (patterns.some(p => p.impact === 'serious'))  return 't2'
  if (patterns.some(p => p.impact === 'moderate')) return 't3'
  if (patterns.some(p => p.impact === 'minor'))    return 't4'
  return null
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
    <Link href={`/sites/${site.id}`} className="block card card-hover p-5 group">
      {/* Header: name + tier badge */}
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="font-bold text-[15px] leading-tight" style={{ color: 'var(--color-text-primary)' }}>
          {site.name}
        </div>
        {tier && <span className={`badge-${tier} shrink-0`}>{tier.toUpperCase()}</span>}
      </div>

      {/* Subtitle */}
      <div className="text-[13px] mb-4" style={{ color: 'var(--color-text-muted)' }}>
        {pageCount} page{pageCount !== 1 ? 's' : ''}
        {site.division ? ` · ${site.division}` : ''}
      </div>

      {/* Divider */}
      <div className="mb-3" style={{ height: '1px', background: 'var(--color-border)' }} />

      {/* Stats row */}
      {latestScan ? (
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-4">
            <div>
              <span className="mono font-semibold text-[20px] leading-none" style={{ color: 'var(--color-text-primary)' }}>
                {latestScan.raw_violation_count}
              </span>
              <span className="text-[12px] ml-1.5" style={{ color: 'var(--color-text-muted)' }}>
                error{latestScan.raw_violation_count !== 1 ? 's' : ''}
              </span>
            </div>
            <div>
              <span className="mono font-medium text-[14px]" style={{ color: 'var(--color-text-secondary)' }}>
                {latestScan.unique_pattern_count}
              </span>
              <span className="text-[12px] ml-1" style={{ color: 'var(--color-text-muted)' }}>
                type{latestScan.unique_pattern_count !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {delta !== null && delta !== 0 && (
              <span
                className="text-[12px] font-semibold px-2 py-0.5 rounded-full"
                style={delta > 0
                  ? { background: 'rgba(58,125,68,0.10)', color: '#3A7D44' }
                  : { background: 'rgba(200,0,42,0.10)', color: '#C8002A' }
                }
                title={delta > 0 ? `${delta} fewer errors than last scan` : `${Math.abs(delta)} more errors than last scan`}
              >
                {delta > 0 ? `↓ ${delta}` : `↑ ${Math.abs(delta)}`}
              </span>
            )}
            <svg
              className="w-4 h-4"
              style={{ color: 'var(--color-hearst-blue)' }}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      ) : (
        <div className="text-[13px] italic" style={{ color: 'var(--color-text-muted)' }}>No scans yet</div>
      )}
    </Link>
  )
}
