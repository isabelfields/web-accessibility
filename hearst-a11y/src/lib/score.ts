import type { ViolationPattern } from '@/types'

const IMPACT_DEDUCTIONS: Record<string, number> = {
  critical: 8,
  serious: 5,
  moderate: 2,
  minor: 0.5,
}

export function calculateScore(patterns: ViolationPattern[]): number {
  let score = 100
  for (const pattern of patterns) {
    const deduction = IMPACT_DEDUCTIONS[pattern.impact] ?? 0
    score -= deduction
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
