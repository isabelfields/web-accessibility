import OpenAI from 'openai'
import { StrippedViolation } from '@/types'

let _openai: OpenAI | undefined
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _openai
}

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

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  })

  const inputTokens = response.usage?.prompt_tokens ?? 0
  const outputTokens = response.usage?.completion_tokens ?? 0
  const text = response.choices[0]?.message?.content ?? ''

  let parsed: Array<{ index: number; fix: string }> = []
  try {
    const clean = text.replace(/```json|```/g, '').trim()
    parsed = JSON.parse(clean)
  } catch {
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
