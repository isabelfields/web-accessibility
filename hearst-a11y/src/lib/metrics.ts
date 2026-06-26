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


function normalizeComponentHtml(html: string): string {
  return html
    .replace(/\s+/g, ' ')
    .replace(/\s(?:data-[^=\s]+|id|class)="[^"]*"/g, '')
    .replace(/\s(?:data-[^=\s]+|id|class)='[^']*'/g, '')
    .trim()
    .slice(0, 500)
}

/**
 * Counts distinct affected components by de-duping repeated failing nodes with
 * the same normalized markup. This separates total issue occurrences from the
 * smaller set of components/templates that likely need a fix.
 */
export function countComponentsWithIssues(patterns: ViolationPattern[], predicate: (pattern: ViolationPattern) => boolean = isActiveWcagPattern): number {
  const components = new Set<string>()
  for (const pattern of patterns) {
    if (!predicate(pattern)) continue
    for (const node of pattern.nodes ?? []) {
      if (node.html) components.add(normalizeComponentHtml(node.html))
    }
    if ((pattern.nodes?.length ?? 0) === 0) components.add(pattern.fingerprint)
  }
  return components.size
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
