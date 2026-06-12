'use client'

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

const TIER_STYLE: Record<string, React.CSSProperties> = {
  T1: { background: '#002D82', color: '#fff' },
  T2: { background: '#005AC8', color: '#fff' },
  T3: { background: '#007AFF', color: '#fff' },
  T4: { background: '#5AC8FA', color: '#fff' },
}

export function SiteCard({ site }: SiteCardProps) {
  const { latestScan } = site
  const pageCount = site.pages?.length ?? 0
  const tier = latestScan ? worstTier(latestScan.patterns ?? []) : null

  return (
    <Link
      href={`/sites/${site.id}`}
      style={{
        display: 'block',
        background: '#fff',
        border: '1px solid #E5E5EA',
        borderRadius: 12,
        padding: '18px 20px',
        textDecoration: 'none',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        transition: 'box-shadow 0.15s, border-color 0.15s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'
        ;(e.currentTarget as HTMLElement).style.borderColor = '#A1A1A6'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'
        ;(e.currentTarget as HTMLElement).style.borderColor = '#E5E5EA'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: '#1D1D1F', fontSize: 15, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{site.name}</div>
          <div style={{ fontSize: 12, color: '#6B6B6B', marginTop: 3 }}>
            {pageCount} page{pageCount !== 1 ? 's' : ''}
            {site.division ? ` · ${site.division}` : ''}
          </div>
        </div>
        {tier && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, flexShrink: 0, ...TIER_STYLE[tier] }}>
            {tier}
          </span>
        )}
      </div>

      {latestScan ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
          <span style={{ fontWeight: 700, color: '#1D1D1F' }}>
            {latestScan.raw_violation_count} error{latestScan.raw_violation_count !== 1 ? 's' : ''}
          </span>
          <span style={{ color: '#6B6B6B' }}>
            {latestScan.unique_pattern_count} type{latestScan.unique_pattern_count !== 1 ? 's' : ''}
          </span>
          <span style={{ color: '#A1A1A6', fontSize: 16 }}>→</span>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: '#6B6B6B', fontStyle: 'italic' }}>No scans yet</div>
      )}
    </Link>
  )
}
