import { RawViolation, StrippedViolation } from '@/types'

/**
 * OPTIMIZATION 2: Don't send raw HTML to Claude.
 *
 * axe-core gives us things like:
 *   <a class="c-header__link u-text-sm tracking-wide font-medium
 *              text-gray-400 hover:text-white transition-colors"
 *      data-analytics="header-nav-home"
 *      data-testid="nav-link"
 *      href="/about">Home</a>
 *
 * Claude doesn't need any of that. It needs:
 *   selector: "a"
 *   context: "anchor with text 'Home', no href"
 *
 * This cuts input tokens by ~60% per violation.
 */

export function stripViolation(violation: RawViolation): StrippedViolation {
  const node = violation.nodes[0] // representative node
  const rawTarget = node?.target?.[0]
  const selector = normalizeSelector(Array.isArray(rawTarget) ? rawTarget[0] : rawTarget)
  const html = typeof node?.html === 'string' ? node.html : ''
  const failureSummary = typeof node?.failureSummary === 'string' ? node.failureSummary : ''
  const context = extractContext(violation.id, html, failureSummary)

  return {
    rule: violation.id,
    impact: violation.impact,
    description: violation.help, // axe's short description (already terse)
    selector,
    context,
  }
}

/**
 * Normalize a CSS selector to its structural essence.
 * Strips IDs (unique per page), data-* attributes, utility classes.
 * Keeps tag name, semantic classes, ARIA attributes.
 *
 * Examples:
 *   "#hero-img-23847"              → "img"
 *   "button.btn.btn-primary"       → "button"
 *   "input[type=text]"             → "input[type=text]"
 *   "a.nav-link"                   → "a"
 */
export function normalizeSelector(selector: unknown): string {
  if (!selector || typeof selector !== 'string') return 'unknown'

  // Get the tag name (everything before the first . # [ )
  const tagMatch = selector.match(/^([a-zA-Z][a-zA-Z0-9]*)/i)
  const tag = tagMatch?.[1]?.toLowerCase() ?? 'element'

  // Keep meaningful attribute selectors ([type=...], [role=...], [aria-*])
  const attrMatches = selector.matchAll(/\[([^\]]+)\]/g)
  const meaningfulAttrs = [...attrMatches]
    .map(m => m[1])
    .filter(attr => {
      const key = attr.split(/[=~|^$*]/)[0]
      return ['type', 'role', 'aria-label', 'aria-labelledby', 'aria-describedby', 'href', 'src'].includes(key)
    })
    .map(attr => `[${attr}]`)

  return tag + meaningfulAttrs.join('')
}

/**
 * Extract a terse, human-readable context string from the raw HTML node.
 * This is what actually gets sent to Claude instead of the raw HTML.
 */
export function extractContext(ruleId: string, html: string, failureSummary: string): string {
  // Use axe's own failure summary if it's short enough
  if (failureSummary && failureSummary.length < 120) {
    return failureSummary.replace(/^Fix (any|all) of the following:\s*/i, '').trim()
  }

  // Rule-specific extractions
  switch (ruleId) {
    case 'color-contrast': {
      // Extract the contrast ratio from axe's message
      const ratioMatch = failureSummary?.match(/(\d+\.\d+):1/)?.[1]
      const reqMatch = failureSummary?.match(/expected (\d+\.\d+):1/)?.[1]
      if (ratioMatch && reqMatch) {
        return `contrast ratio ${ratioMatch}:1, required ${reqMatch}:1`
      }
      return 'insufficient color contrast between text and background'
    }

    case 'image-alt': {
      const srcMatch = html.match(/src="([^"]{0,60})"/)
      const src = srcMatch?.[1] ? `src="${truncate(srcMatch[1], 40)}"` : ''
      return `img without alt attribute${src ? `, ${src}` : ''}`
    }

    case 'aria-required-attr': {
      const roleMatch = html.match(/role="([^"]+)"/)
      return roleMatch ? `role="${roleMatch[1]}" missing required ARIA attributes` : 'element missing required ARIA attributes'
    }

    case 'aria-allowed-attr': {
      const attrMatch = failureSummary?.match(/aria-\w+/g)
      return attrMatch ? `invalid ARIA attributes: ${attrMatch.join(', ')}` : 'element has disallowed ARIA attributes'
    }

    default: {
      // Generic: extract tag, visible text (if short), and ARIA attributes
      const tagMatch = html.match(/^<([a-z][a-z0-9]*)/i)
      const tag = tagMatch?.[1] ?? 'element'

      const ariaLabel = html.match(/aria-label="([^"]{0,60})"/)
      const visibleText = extractVisibleText(html)
      const role = html.match(/role="([^"]+)"/)

      const parts: string[] = [tag]
      if (role) parts.push(`role="${role[1]}"`)
      if (ariaLabel) parts.push(`aria-label="${ariaLabel[1]}"`)
      else if (visibleText) parts.push(`text: "${truncate(visibleText, 40)}"`)

      return parts.join(', ')
    }
  }
}

function extractVisibleText(html: string): string {
  // Strip all tags and collapse whitespace
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '…' : str
}
