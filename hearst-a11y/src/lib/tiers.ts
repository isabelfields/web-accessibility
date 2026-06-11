export type Tier = 'tier1' | 'tier2' | 'tier3' | 'tier4'

export const TIER_LABEL: Record<Tier, string> = {
  tier1: 'T1 Critical',
  tier2: 'T2 Serious',
  tier3: 'T3 Moderate',
  tier4: 'T4 Minor',
}

export const TIER_COLOR: Record<Tier, { text: string; bg: string; border: string; dot: string; hex: string; swimlane: string }> = {
  tier1: { text: 'text-[#002D82]', bg: 'bg-[#002D82]/10', border: 'border-[#002D82]/30', dot: 'bg-[#002D82]', hex: '#002D82', swimlane: '#002D82' },
  tier2: { text: 'text-[#005AC8]', bg: 'bg-[#005AC8]/10', border: 'border-[#005AC8]/30', dot: 'bg-[#005AC8]', hex: '#005AC8', swimlane: '#005AC8' },
  tier3: { text: 'text-[#007AFF]', bg: 'bg-[#007AFF]/10', border: 'border-[#007AFF]/30', dot: 'bg-[#007AFF]', hex: '#007AFF', swimlane: '#007AFF' },
  tier4: { text: 'text-[#5AC8FA]', bg: 'bg-[#5AC8FA]/10', border: 'border-[#5AC8FA]/30', dot: 'bg-[#5AC8FA]', hex: '#5AC8FA', swimlane: '#5AC8FA' },
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
