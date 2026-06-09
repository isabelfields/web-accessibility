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
  }
}

function worstTier(patterns: { impact: string }[] = []): string | null {
  if (patterns.some(p => p.impact === 'critical')) return 'T1'
  if (patterns.some(p => p.impact === 'serious'))  return 'T2'
  if (patterns.some(p => p.impact === 'moderate')) return 'T3'
  if (patterns.some(p => p.impact === 'minor'))    return 'T4'
  return null
}

const TIER_BADGE: Record<string, { color: string; bg: string; border: string }> = {
  T1: { color: '#002D82', bg: 'rgba(0,45,130,0.10)',   border: 'rgba(0,45,130,0.25)' },
  T2: { color: '#005AC8', bg: 'rgba(0,90,200,0.10)',   border: 'rgba(0,90,200,0.25)' },
  T3: { color: '#007AFF', bg: 'rgba(0,122,255,0.10)',  border: 'rgba(0,122,255,0.25)' },
  T4: { color: '#0A84CC', bg: 'rgba(90,200,250,0.12)', border: 'rgba(90,200,250,0.35)' },
}

export function SiteCard({ site }: SiteCardProps) {
  const { latestScan } = site
  const pageCount = site.pages?.length ?? 0
  const tier = latestScan ? worstTier(latestScan.patterns ?? []) : null
  const tb = tier ? TIER_BADGE[tier] : null

  return (
    <Link
      href={`/sites/${site.id}`}
      className="card card-hover block"
      style={{ textDecoration: 'none', padding: '16px 18px' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: '#1D1D1F', fontSize: '14px', lineHeight: '1.3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{site.name}</div>
          <div style={{ fontSize: '12px', color: '#86868B', marginTop: '2px' }}>
            {pageCount} page{pageCount !== 1 ? 's' : ''}
            {site.division ? ` · ${site.division}` : ''}
          </div>
        </div>
        {tb && tier && (
          <span style={{
            flexShrink: 0, fontSize: '10px', fontWeight: 600,
            fontFamily: '"JetBrains Mono", monospace',
            padding: '2px 8px', borderRadius: '999px',
            color: tb.color, background: tb.bg, border: `1px solid ${tb.border}`,
          }}>
            {tier}
          </span>
        )}
      </div>

      {latestScan ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
          <span style={{ fontWeight: 600, color: '#1D1D1F' }}>
            {latestScan.raw_violation_count} error{latestScan.raw_violation_count !== 1 ? 's' : ''}
          </span>
          <span style={{ color: '#86868B' }}>
            {latestScan.unique_pattern_count} type{latestScan.unique_pattern_count !== 1 ? 's' : ''}
          </span>
          <span style={{ color: '#007AFF' }} aria-hidden="true">→</span>
        </div>
      ) : (
        <div style={{ fontSize: '12px', color: '#86868B', fontStyle: 'italic' }}>No scans yet</div>
      )}
    </Link>
  )
}
