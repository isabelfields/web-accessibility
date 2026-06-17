import type { ViolationPattern } from '@/types'

/** Score deducted per non-best-practice violation, by axe impact level. */
export const IMPACT_DEDUCTIONS: Record<string, number> = {
  critical: 8,
  serious: 5,
  moderate: 2,
  minor: 0.5,
}

/** Deduction for a single impact level (0 if unknown). */
export function impactDeduction(impact: string): number {
  return IMPACT_DEDUCTIONS[impact] ?? 0
}

/**
 * A violation is "best practice" (not a WCAG failure, so it doesn't affect the
 * score) when axe tags it best-practice and none of its tags are WCAG tags.
 */
export function isBestPractice(tags: string[] | undefined): boolean {
  const t = tags ?? []
  return t.includes('best-practice') && !t.some(tag => tag.startsWith('wcag'))
}

export function calculateScore(patterns: ViolationPattern[]): number {
  let score = 100
  for (const pattern of patterns) {
    if (pattern.isBestPractice) continue
    score -= impactDeduction(pattern.impact)
  }
  return Math.max(0, score)
}

export function scoreGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}
