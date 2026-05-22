import Anthropic from '@anthropic-ai/sdk'
import { StrippedViolation } from '@/types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface ViolationInput extends StrippedViolation {
  fingerprint: string
}

interface SuggestionResult {
  fingerprint: string
  fixSuggestion: string
}

interface ClaudeResponse {
  suggestions: SuggestionResult[]
  inputTokens: number
  outputTokens: number
}

/**
 * Sends a batch of stripped (NOT raw HTML) violations to Claude.
 * Returns fix suggestions keyed by fingerprint.
 *
 * We send stripped violations like:
 *   { rule: "color-contrast", selector: "a", context: "contrast 2.1:1, required 4.5:1" }
 *
 * NOT raw HTML like:
 *   { html: "<a class='nav-link u-text-sm tracking-wide...' data-analytics='...'>Home</a>" }
 */
export async function getClaudeSuggestions(
  violations: ViolationInput[]
): Promise<ClaudeResponse> {
  const violationList = violations
    .map((v, i) =>
      `${i + 1}. rule: "${v.rule}" | impact: ${v.impact} | element: <${v.selector}> | context: ${v.context}`
    )
    .join('\n')

  const prompt = `You are an expert web accessibility engineer familiar with WCAG 2.1 and 2.2.

For each accessibility violation below, provide a concise, actionable fix suggestion in 1–3 sentences. Focus on the specific code change needed. Use inline code formatting for HTML/attributes.

Violations:
${violationList}

Respond with a JSON array only — no markdown, no preamble. Each item must have:
- "index": number (1-based, matching the list above)
- "fix": string (the fix suggestion)

Example:
[{"index":1,"fix":"Add \`aria-label\` to this button..."},{"index":2,"fix":"..."}]`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  })

  const inputTokens = message.usage.input_tokens
  const outputTokens = message.usage.output_tokens

  // Parse response
  const text = message.content
    .filter(block => block.type === 'text')
    .map(block => (block as { type: 'text'; text: string }).text)
    .join('')

  let parsed: Array<{ index: number; fix: string }> = []
  try {
    const clean = text.replace(/```json|```/g, '').trim()
    parsed = JSON.parse(clean)
  } catch {
    // Fallback: return a generic message for each
    return {
      suggestions: violations.map(v => ({
        fingerprint: v.fingerprint,
        fixSuggestion: `Review this ${v.rule} violation and ensure it meets WCAG 2.1 requirements. See: https://dequeuniversity.com/rules/axe/${v.rule}`,
      })),
      inputTokens,
      outputTokens,
    }
  }

  const suggestions: SuggestionResult[] = parsed.map(item => ({
    fingerprint: violations[item.index - 1]?.fingerprint ?? '',
    fixSuggestion: item.fix,
  }))

  return { suggestions, inputTokens, outputTokens }
}
