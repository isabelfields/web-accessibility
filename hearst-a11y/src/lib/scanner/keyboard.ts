import type { Page } from 'playwright'
import type { RawViolation } from '@/types'

const MAX_TABS = 120

export async function runKeyboardCheck(page: Page): Promise<RawViolation[]> {
  const violations: RawViolation[] = []

  try {
    // Focus the page body first so Tab starts from the top
    await page.evaluate(() => { (document.body as HTMLElement).focus() })

    const focusedSelectors: string[] = []
    type FocusEntry = { selector: string; hasOutline: boolean; html: string }
    const focusEntries: FocusEntry[] = []

    for (let i = 0; i < MAX_TABS; i++) {
      await page.keyboard.press('Tab')

      const focused = await page.evaluate((): FocusEntry | null => {
        const el = document.activeElement
        if (!el || el === document.body || el === document.documentElement) return null

        const getSelector = (el: Element): string => {
          if (el.id) return `#${CSS.escape(el.id)}`
          const tag = el.tagName.toLowerCase()
          const cls = Array.from(el.classList).slice(0, 2).join('.')
          return cls ? `${tag}.${cls}` : tag
        }

        const styles = window.getComputedStyle(el)
        const outlineWidth = parseFloat(styles.outlineWidth || '0')
        const outlineStyle = styles.outlineStyle
        const boxShadow = styles.boxShadow
        const hasOutline =
          (outlineWidth > 0 && outlineStyle !== 'none') ||
          (boxShadow !== 'none' && boxShadow !== '' && boxShadow !== 'none 0px 0px 0px 0px')

        return {
          selector: getSelector(el),
          hasOutline,
          html: el.outerHTML.slice(0, 300),
        }
      })

      if (!focused) break

      focusedSelectors.push(focused.selector)
      focusEntries.push(focused)

      // Detect focus trap: same selector repeating in last 6 tabs
      if (focusedSelectors.length >= 6) {
        const last6 = focusedSelectors.slice(-6)
        const unique = new Set(last6)
        if (unique.size <= 2) {
          violations.push({
            id: 'keyboard-focus-trap',
            impact: 'serious',
            description: 'Keyboard focus appears to be trapped — Tab key cycles within a small region and cannot reach the rest of the page.',
            help: 'Ensure keyboard focus is not trapped in any component (WCAG 2.1 SC 2.1.2)',
            helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/no-keyboard-trap.html',
            nodes: [{ html: last6[0], target: [last6[0]], failureSummary: `Focus cycling between: ${[...unique].join(', ')}` }],
          })
          break
        }
      }
    }

    // Check for missing focus indicators
    const noOutline = focusEntries.filter(f => !f.hasOutline)
    if (noOutline.length > 0) {
      violations.push({
        id: 'keyboard-focus-indicator',
        impact: 'serious',
        description: `${noOutline.length} interactive element${noOutline.length !== 1 ? 's' : ''} had no visible focus indicator when reached by keyboard (WCAG 2.2 SC 2.4.11).`,
        help: 'All interactive elements must display a visible focus indicator when focused',
        helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html',
        nodes: noOutline.slice(0, 10).map(f => ({
          html: f.html,
          target: [f.selector],
          failureSummary: 'No visible focus indicator (outline/box-shadow) detected on focus',
        })),
      })
    }

    // Check for interactive elements not reachable by Tab
    const allInteractive = await page.evaluate((): string[] => {
      const sel = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      return Array.from(document.querySelectorAll(sel))
        .filter(el => {
          const s = window.getComputedStyle(el)
          return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0'
        })
        .map(el => {
          if (el.id) return `#${CSS.escape(el.id)}`
          return el.tagName.toLowerCase()
        })
        .slice(0, 60)
    })

    if (allInteractive.length > 0) {
      const focusedSet = new Set(focusedSelectors)
      const unreachable = allInteractive.filter(sel => !focusedSet.has(sel))
      // Only flag if a meaningful portion is unreachable (not just scroll-off-screen elements)
      if (unreachable.length > 0 && unreachable.length <= allInteractive.length * 0.6) {
        violations.push({
          id: 'keyboard-unreachable',
          impact: 'moderate',
          description: `${unreachable.length} interactive element${unreachable.length !== 1 ? 's' : ''} could not be reached using the Tab key.`,
          help: 'All interactive elements should be reachable via keyboard navigation (WCAG 2.1 SC 2.1.1)',
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/keyboard.html',
          nodes: unreachable.slice(0, 10).map(sel => ({
            html: sel,
            target: [sel],
            failureSummary: 'Element not reached during keyboard Tab navigation',
          })),
        })
      }
    }
  } catch (err) {
    console.warn('[keyboard] Check failed:', err instanceof Error ? err.message : err)
  }

  return violations
}
