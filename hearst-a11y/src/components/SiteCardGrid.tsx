'use client'

import { useState, useMemo } from 'react'
import { SiteCard } from '@/components/SiteCard'
import { countOccurrences, countIssueTypes, isWcagPattern } from '@/lib/metrics'
import type { ViolationPattern } from '@/types'

type Site = {
  id: string
  name: string
  division?: string
  pages: { url: string; label: string; templateType: string }[]
  created_at: string
  latestScan: {
    score: number
    status: string
    started_at: string
    unique_pattern_count: number
    raw_violation_count: number
    patterns?: ViolationPattern[]
  } | null
}

type SortKey = 'most-issues' | 'fewest-issues' | 'worst-tier' | 'alpha'

const TIER_RANK: Record<string, number> = { T1: 0, T2: 1, T3: 2, T4: 3 }

function worstTierRank(patterns: ViolationPattern[] = []): number {
  if (patterns.some(p => p.impact === 'critical')) return 0
  if (patterns.some(p => p.impact === 'serious'))  return 1
  if (patterns.some(p => p.impact === 'moderate')) return 2
  if (patterns.some(p => p.impact === 'minor'))    return 3
  return 4
}

export function SiteCardGrid({ sites, divisions }: { sites: Site[]; divisions: string[] }) {
  const [divFilter, setDivFilter] = useState<string>('all')
  const [sort, setSort] = useState<SortKey>('worst-tier')

  const filtered = useMemo(() => {
    const base = divFilter === 'all' ? sites : sites.filter(s => s.division === divFilter)
    return [...base].sort((a, b) => {
      const ap = (a.latestScan?.patterns ?? []).filter(isWcagPattern)
      const bp = (b.latestScan?.patterns ?? []).filter(isWcagPattern)
      if (sort === 'most-issues') return countOccurrences(bp, isWcagPattern) - countOccurrences(ap, isWcagPattern)
      if (sort === 'fewest-issues') return countOccurrences(ap, isWcagPattern) - countOccurrences(bp, isWcagPattern)
      if (sort === 'worst-tier') {
        const diff = worstTierRank(ap) - worstTierRank(bp)
        return diff !== 0 ? diff : countOccurrences(bp, isWcagPattern) - countOccurrences(ap, isWcagPattern)
      }
      return a.name.localeCompare(b.name)
    })
  }, [sites, divFilter, sort])

  const showDivFilter = divisions.length > 1

  return (
    <>
      {(showDivFilter) && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
          {showDivFilter && (
            <select
              value={divFilter}
              onChange={e => setDivFilter(e.target.value)}
              style={{
                fontSize: 12, fontWeight: 600, color: '#57575A', background: '#fff',
                border: '1px solid #E5E5EA', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', outline: 'none',
              }}
              aria-label="Filter by division"
            >
              <option value="all">All divisions</option>
              {divisions.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortKey)}
            style={{
              fontSize: 12, fontWeight: 600, color: '#57575A', background: '#fff',
              border: '1px solid #E5E5EA', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', outline: 'none',
            }}
            aria-label="Sort sites"
          >
            <option value="worst-tier">Sort: Most critical tier</option>
            <option value="most-issues">Sort: Most issues</option>
            <option value="fewest-issues">Sort: Fewest issues</option>
            <option value="alpha">Sort: A–Z</option>
          </select>
          {divFilter !== 'all' && (
            <span style={{ fontSize: 12, color: '#57575A' }}>
              {filtered.length} site{filtered.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}
      <div className="site-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
        {filtered.map((site: Site) => (
          <SiteCard key={site.id} site={site} />
        ))}
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1/-1', padding: '32px 0', textAlign: 'center', color: '#57575A', fontSize: 13 }}>
            No sites match the current filter.
          </div>
        )}
      </div>
    </>
  )
}
