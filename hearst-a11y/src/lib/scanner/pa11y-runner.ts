import { RawViolation } from '@/types'

const PA11Y_TO_IMPACT: Record<string, 'critical' | 'serious' | 'moderate' | 'minor'> = {
  error: 'serious',
  warning: 'moderate',
  notice: 'minor',
}

// Map pa11y WCAG codes to axe-style rule IDs where possible
const PA11Y_CODE_TO_RULE: Record<string, string> = {
  'WCAG2AA.Principle1.Guideline1_1.1_1_1': 'image-alt',
  'WCAG2AA.Principle1.Guideline1_3.1_3_1': 'region',
  'WCAG2AA.Principle1.Guideline1_4.1_4_3': 'color-contrast',
  'WCAG2AA.Principle2.Guideline2_4.2_4_1': 'bypass',
  'WCAG2AA.Principle2.Guideline2_4.2_4_2': 'document-title',
  'WCAG2AA.Principle3.Guideline3_1.3_1_1': 'html-has-lang',
  'WCAG2AA.Principle4.Guideline4_1.4_1_1': 'duplicate-id',
  'WCAG2AA.Principle4.Guideline4_1.4_1_2': 'label',
}

export async function runPa11y(url: string): Promise<RawViolation[]> {
  try {
    // pa11y requires a local Chrome — use puppeteer-core with browserless
    const pa11y = (await import('pa11y')).default
    const results = await (pa11y as any)(url, {
      standard: 'WCAG2AA',
      timeout: 20000,
      chromeLaunchConfig: {
        executablePath: undefined,
        browserWSEndpoint: `wss://chrome.browserless.io?token=${process.env.BROWSERLESS_TOKEN}`,
        args: [],
      },
      runners: ['htmlcs', 'axe'],
    } as any)

    // Convert pa11y issues to RawViolation format
    const byCode = new Map<string, RawViolation>()

    for (const issue of results.issues ?? []) {
      const ruleId = PA11Y_CODE_TO_RULE[issue.code] ?? issue.code
      const impact = PA11Y_TO_IMPACT[issue.type] ?? 'minor'

      if (byCode.has(ruleId)) {
        byCode.get(ruleId)!.nodes.push({
          html: issue.context ?? '',
          target: [issue.selector ?? ''],
          failureSummary: issue.message,
        })
      } else {
        byCode.set(ruleId, {
          id: `pa11y-${ruleId}`,
          impact,
          description: issue.message,
          help: issue.message,
          helpUrl: `https://www.w3.org/WAI/WCAG21/Techniques/`,
          nodes: [{
            html: issue.context ?? '',
            target: [issue.selector ?? ''],
            failureSummary: issue.message,
          }],
        })
      }
    }

    return [...byCode.values()]
  } catch {
    // pa11y failure is non-fatal — axe results still used
    return []
  }
}

export function mergeViolations(axeViolations: RawViolation[], pa11yViolations: RawViolation[]): RawViolation[] {
  const merged = [...axeViolations]
  const axeRuleIds = new Set(axeViolations.map(v => v.id))

  for (const v of pa11yViolations) {
    // Only add pa11y results that axe didn't already catch
    const baseId = v.id.replace('pa11y-', '')
    if (!axeRuleIds.has(baseId) && !axeRuleIds.has(v.id)) {
      merged.push(v)
    }
  }

  return merged
}
