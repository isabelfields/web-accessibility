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
    <Link
      href={`/sites/${site.id}`}
      className="block card-hover"
      style={{
        background: '#FFFFFF',
        borderRadius: '12px',
        padding: '20px 20px 16px',
        boxShadow: '0 1px 3px rgba(10,22,40,0.08), 0 1px 2px rgba(10,22,40,0.04)',
        display: 'block',
        textDecoration: 'none',
      }}
    >
      {/* Header: name + tier badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: 1.3 }}>
          {site.name}
        </div>
        {tier && <span className={`badge-${tier}`} style={{ flexShrink: 0 }}>{tier.toUpperCase()}</span>}
      </div>

      {/* Meta */}
      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '14px' }}>
        {pageCount} page{pageCount !== 1 ? 's' : ''}
        {site.division ? ` · ${site.division}` : ''}
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: 'var(--color-border)', marginBottom: '14px' }} />

      {/* Stats row */}
      {latestScan ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div>
            <span className="mono" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}>
              {latestScan.raw_violation_count}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginLeft: '4px' }}>
              error{latestScan.raw_violation_count !== 1 ? 's' : ''}
            </span>
          </div>
          <div>
            <span className="mono" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}>
              {latestScan.unique_pattern_count}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginLeft: '4px' }}>
              type{latestScan.unique_pattern_count !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {delta !== null && delta !== 0 && (
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  ...(delta > 0
                    ? { background: 'rgba(58,125,68,0.10)', color: '#3A7D44' }
                    : { background: 'rgba(200,0,42,0.10)', color: '#C8002A' })
                }}
                title={delta > 0 ? `${delta} fewer errors than last scan` : `${Math.abs(delta)} more errors than last scan`}
              >
                {delta > 0 ? `↓ ${delta}` : `↑ ${Math.abs(delta)}`}
              </span>
            )}
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"
              style={{ color: 'var(--color-hearst-blue)', flexShrink: 0 }} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      ) : (
        <div style={{ fontSize: '13px', fontStyle: 'italic', color: 'var(--color-text-muted)' }}>No scans yet</div>
      )}
    </Link>
  )
}
