import type { ImpactLevel, ViolationPattern } from '@/types'

export const METRIC_LABELS = {
  totalIssues: 'Total Issues',
  componentsWithIssues: 'Components with Issues',
  issueTypes: 'Issue Types',
  failingElements: 'failing elements',
  activeComponentsWithIssues: 'active components with issues',
} as const

export type SeverityCounts = Record<ImpactLevel, number>

export const EMPTY_SEVERITY_COUNTS: SeverityCounts = {
  critical: 0,
  serious: 0,
  moderate: 0,
  minor: 0,
}

/** Active WCAG errors exclude best-practice-only rules and triaged/dismissed patterns. */
export function isActiveWcagPattern(pattern: ViolationPattern): boolean {
  return !pattern.isBestPractice && (pattern.triageStatus ?? 'open') === 'open'
}

/** Stored scan totals do not include triage state, but can still exclude best-practice-only findings. */
export function isWcagPattern(pattern: ViolationPattern): boolean {
  return !pattern.isBestPractice
}

export function countOccurrences(patterns: ViolationPattern[], predicate: (pattern: ViolationPattern) => boolean = () => true): number {
  return patterns.filter(predicate).reduce((sum, pattern) => sum + pattern.occurrences, 0)
}

export function countIssueTypes(patterns: ViolationPattern[], predicate: (pattern: ViolationPattern) => boolean = () => true): number {
  return patterns.filter(predicate).length
}


/**
 * Counts unique affected elements by deduplicating nodes across patterns.
 * Two nodes with the same HTML on the same URL are treated as the same element.
 * Uses the stored nodes sample, so this is an approximate lower bound for large scans.
 */
export function countComponentsWithIssues(patterns: ViolationPattern[], predicate: (pattern: ViolationPattern) => boolean = isActiveWcagPattern): number {
  const seen = new Set<string>()
  for (const pattern of patterns) {
    if (!predicate(pattern)) continue
    for (const node of pattern.nodes) {
      seen.add(`${node.url}|${node.html}`)
    }
  }
  return seen.size
}

export function getSeverityCounts(patterns: ViolationPattern[], predicate: (pattern: ViolationPattern) => boolean = isActiveWcagPattern): SeverityCounts {
  const counts: SeverityCounts = { ...EMPTY_SEVERITY_COUNTS }
  for (const pattern of patterns) {
    if (!predicate(pattern)) continue
    counts[pattern.impact] += pattern.occurrences
  }
  return counts
}

export function formatSignedDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : `${delta}`
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural
}
