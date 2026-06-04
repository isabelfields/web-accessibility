export type Tier = 'tier1' | 'tier2' | 'tier3' | 'tier4'

export const TIER_LABEL: Record<Tier, string> = {
  tier1: 'Tier 1',
  tier2: 'Tier 2',
  tier3: 'Tier 3',
  tier4: 'Tier 4',
}

export const TIER_COLOR: Record<Tier, { text: string; bg: string; border: string; dot: string; hex: string }> = {
  tier1: { text: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/30',    dot: 'bg-red-500',    hex: '#ef4444' },
  tier2: { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', dot: 'bg-orange-500', hex: '#f97316' },
  tier3: { text: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/30',  dot: 'bg-amber-400',  hex: '#f59e0b' },
  tier4: { text: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   dot: 'bg-blue-400',   hex: '#60a5fa' },
}

export function impactToTier(impact: string): Tier {
  if (impact === 'critical') return 'tier1'
  if (impact === 'serious')  return 'tier2'
  if (impact === 'moderate') return 'tier3'
  return 'tier4'
}

export function patternsToWorstTier(patterns: { impact: string }[]): Tier | null {
  if (patterns.length === 0) return null
  if (patterns.some(p => p.impact === 'critical')) return 'tier1'
  if (patterns.some(p => p.impact === 'serious'))  return 'tier2'
  if (patterns.some(p => p.impact === 'moderate')) return 'tier3'
  return 'tier4'
}
