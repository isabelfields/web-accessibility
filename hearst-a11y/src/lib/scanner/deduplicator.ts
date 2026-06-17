import { RawViolation, ViolationPattern, PatternNode, StrippedViolation } from '@/types'
import { getKnownFix, partitionByKnowledge } from './known-fixes'
import { stripViolation, normalizeSelector } from './strip-html'
import { getClaudeSuggestions } from '../claude/suggestions'
import { isBestPractice } from '@/lib/score'
import { AI, MAX_NODES_PER_RULE } from '@/lib/constants'

/**
 * Takes raw violations from multiple pages and returns deduplicated patterns
 * with fix suggestions — using hardcoded rules where possible, Claude otherwise.
 *
 * Pipeline:
 * 1. Strip raw HTML from all violations (optimization 2)
 * 2. Fingerprint each: rule + normalized selector → unique pattern key
 * 3. Group all instances by fingerprint
 * 4. Apply known fixes (optimization 3) — no API call
 * 5. Batch-send unknown violations to Claude in one call per ~20 violations
 */
export async function deduplicateAndFix(
  pageViolations: Array<{ url: string; violations: RawViolation[] }>
): Promise<{
  patterns: ViolationPattern[]
  claudeCallCount: number
  estimatedCostUsd: number
}> {
  // Step 1 & 2: Strip and fingerprint all violations
  // Fingerprint by rule ID only — same rule on different selectors is the same
  // issue type. occurrences = total failing element nodes across all instances.
  const patternMap = new Map<string, {
    stripped: StrippedViolation
    occurrences: number
    affectedPages: Set<string>
    nodes: PatternNode[]
    isBestPractice: boolean
  }>()

  for (const { url, violations } of pageViolations) {
    for (const violation of violations) {
      const stripped = stripViolation(violation)
      const fingerprint = stripped.rule  // one card per rule type

      // Collect each failing node (capped per rule to keep DB size sane)
      const newNodes: PatternNode[] = (violation.nodes ?? []).slice(0, MAX_NODES_PER_RULE).map(n => ({
        html: n.html ?? '',
        url,
        screenshot: (violation as any).sampleScreenshot,
      }))
      const nodeCount = Math.max(1, newNodes.length)
      const bestPractice = isBestPractice(violation.tags)

      if (patternMap.has(fingerprint)) {
        const existing = patternMap.get(fingerprint)!
        existing.occurrences += nodeCount
        existing.affectedPages.add(url)
        // Cap total stored nodes across all pages
        const remaining = MAX_NODES_PER_RULE - existing.nodes.length
        if (remaining > 0) existing.nodes.push(...newNodes.slice(0, remaining))
      } else {
        patternMap.set(fingerprint, {
          stripped,
          occurrences: nodeCount,
          affectedPages: new Set([url]),
          nodes: newNodes,
          isBestPractice: bestPractice,
        })
      }
    }
  }

  // Step 3: Split by whether we know the fix
  const fingerprints = [...patternMap.keys()]
  const ruleIds = fingerprints.map(fp => fp.split('::')[0])
  const { known: knownRuleIds, unknown: unknownRuleIds } = partitionByKnowledge(ruleIds)

  const knownFingerprints = fingerprints.filter(fp => knownRuleIds.includes(fp.split('::')[0]))
  const unknownFingerprints = fingerprints.filter(fp => unknownRuleIds.includes(fp.split('::')[0]))

  const patterns: ViolationPattern[] = []

  // Step 4: Apply known fixes (free, no Claude)
  for (const fp of knownFingerprints) {
    const entry = patternMap.get(fp)!
    const fix = getKnownFix(entry.stripped.rule)!
    patterns.push({
      fingerprint: fp,
      rule: entry.stripped.rule,
      impact: entry.stripped.impact,
      description: entry.stripped.description,
      fixSuggestion: fix,
      isHardcoded: true,
      isBestPractice: entry.isBestPractice,
      occurrences: entry.occurrences,
      affectedPages: [...entry.affectedPages],
      nodes: entry.nodes,
    })
  }

  // Step 5: Batch-send unknown violations to Claude
  let claudeCallCount = 0
  let totalInputTokens = 0
  let totalOutputTokens = 0

  if (unknownFingerprints.length > 0) {
    // Batch to keep each prompt a reasonable size
    const batches = chunk(unknownFingerprints, AI.BATCH_SIZE)

    for (const batch of batches) {
      const items = batch.map(fp => {
        const entry = patternMap.get(fp)!
        return { fingerprint: fp, ...entry.stripped }
      })

      const result = await getClaudeSuggestions(items)
      claudeCallCount++
      totalInputTokens += result.inputTokens
      totalOutputTokens += result.outputTokens

      const suggestionMap = new Map(result.suggestions.map(s => [s.fingerprint, s.fixSuggestion]))

      for (const fingerprint of batch) {
        const entry = patternMap.get(fingerprint)!
        patterns.push({
          fingerprint,
          rule: entry.stripped.rule,
          impact: entry.stripped.impact,
          description: entry.stripped.description,
          fixSuggestion: suggestionMap.get(fingerprint) ?? 'Review this element and ensure it meets WCAG AA requirements.',
          isHardcoded: false,
          isBestPractice: entry.isBestPractice,
          occurrences: entry.occurrences,
          affectedPages: [...entry.affectedPages],
          nodes: entry.nodes,
        })
      }
    }
  }

  // Rough cost estimate at the configured model's rates (see AI constants).
  const estimatedCostUsd =
    (totalInputTokens / 1_000_000) * AI.INPUT_USD_PER_MTOK +
    (totalOutputTokens / 1_000_000) * AI.OUTPUT_USD_PER_MTOK

  // Sort by impact severity
  const impactOrder: Record<string, number> = { critical: 0, serious: 1, moderate: 2, minor: 3 }
  patterns.sort((a, b) => (impactOrder[a.impact] ?? 9) - (impactOrder[b.impact] ?? 9))

  return { patterns, claudeCallCount, estimatedCostUsd }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size))
  return result
}
