import { ImpactLevel } from '@/types'

interface KnownFix {
  fix: string
  impact: ImpactLevel
}

/**
 * OPTIMIZATION 3: Rule-based pre-answers for well-known violations.
 * These rules have the same fix every time — no need to call Claude.
 * Saves ~40% of Claude calls on average.
 */
export const KNOWN_FIXES: Record<string, KnownFix> = {
  'image-alt': {
    fix: 'Add a descriptive `alt` attribute to this `<img>`. If the image is decorative, use `alt=""`. If it conveys meaning, describe what it shows in 1–2 sentences.',
    impact: 'critical',
  },
  'label': {
    fix: 'Associate a `<label>` with this form input. Add a matching `for` attribute on the label and `id` on the input, e.g. `<label for="email">Email</label><input id="email">`.',
    impact: 'critical',
  },
  'document-title': {
    fix: 'Add a unique, descriptive `<title>` element inside `<head>`. It should describe the page content, e.g. `<title>Contact Us | Hearst</title>`.',
    impact: 'serious',
  },
  'html-has-lang': {
    fix: 'Add a `lang` attribute to the `<html>` element, e.g. `<html lang="en">`. This tells screen readers which language to use.',
    impact: 'serious',
  },
  'html-lang-valid': {
    fix: 'The `lang` attribute on `<html>` uses an invalid value. Use a valid BCP 47 language tag, e.g. `lang="en"`, `lang="es"`, `lang="fr"`.',
    impact: 'serious',
  },
  'link-name': {
    fix: 'This link has no accessible name. Either add visible text inside the `<a>`, or add `aria-label="descriptive text"`, or use `aria-labelledby` pointing to a visible label.',
    impact: 'serious',
  },
  'button-name': {
    fix: 'This button has no accessible name. Add visible text inside the `<button>`, or add `aria-label="descriptive action"`, e.g. `<button aria-label="Close menu">`.',
    impact: 'critical',
  },
  'frame-title': {
    fix: 'Add a `title` attribute to this `<iframe>` that describes its content, e.g. `<iframe title="Embedded video: Product demo">`.',
    impact: 'serious',
  },
  'duplicate-id': {
    fix: 'Each `id` attribute must be unique on the page. Rename this element\'s `id` to something unique, and update any `for`, `aria-labelledby`, or `aria-describedby` references.',
    impact: 'moderate',
  },
  'skip-link': {
    fix: 'Add a "Skip to main content" link as the first focusable element on the page. This lets keyboard users bypass navigation: `<a href="#main" class="sr-only focus:not-sr-only">Skip to main content</a>`.',
    impact: 'moderate',
  },
  'landmark-one-main': {
    fix: 'Add exactly one `<main>` element (or `role="main"`) to the page. This gives screen reader users a way to jump to the primary content.',
    impact: 'moderate',
  },
  'region': {
    fix: 'All page content should be contained within landmark regions (`<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>`). Wrap the orphaned content in the appropriate landmark element.',
    impact: 'moderate',
  },
  'list': {
    fix: 'The children of `<ul>` or `<ol>` must be `<li>` elements only. Move any non-`<li>` children outside the list or wrap them in `<li>` tags.',
    impact: 'moderate',
  },
  'listitem': {
    fix: '`<li>` elements must be direct children of `<ul>` or `<ol>`. Wrap this `<li>` inside the appropriate list element.',
    impact: 'moderate',
  },
  'meta-refresh': {
    fix: 'Remove the `<meta http-equiv="refresh">` tag. Auto-refreshing pages disorients screen reader users. Use server-side redirects instead.',
    impact: 'critical',
  },
  'tabindex': {
    fix: 'Avoid using `tabindex` values greater than 0. Use `tabindex="0"` to make elements focusable in natural DOM order, or `tabindex="-1"` for programmatic focus only.',
    impact: 'serious',
  },
  'th-has-data-cells': {
    fix: 'This `<th>` header cell has no associated data cells. Ensure the table structure is correct and every header maps to data rows/columns using `scope="col"` or `scope="row"`.',
    impact: 'serious',
  },
  'td-headers-attr': {
    fix: 'This `<td>` references header IDs via the `headers` attribute, but those IDs don\'t exist or don\'t point to `<th>` elements. Fix the `headers` attribute to reference valid `<th id>` values.',
    impact: 'serious',
  },
  'aria-required-children': {
    fix: 'This ARIA role requires specific child roles that are missing. Check the WAI-ARIA spec for the required owned elements and add the missing children.',
    impact: 'critical',
  },
  'aria-required-parent': {
    fix: 'This ARIA role must be contained within a specific parent role. Wrap this element in the required parent, e.g. `role="listitem"` must be inside `role="list"`.',
    impact: 'critical',
  },
  'aria-valid-attr': {
    fix: 'One or more `aria-*` attributes on this element are not valid ARIA attributes. Check for typos and consult the WAI-ARIA attribute list.',
    impact: 'critical',
  },
  'aria-valid-attr-value': {
    fix: 'An `aria-*` attribute on this element has an invalid value. Verify the value matches what the ARIA spec allows for that attribute.',
    impact: 'critical',
  },
}

/**
 * Returns a hardcoded fix if one exists, otherwise null (→ send to Claude).
 */
export function getKnownFix(ruleId: string): string | null {
  return KNOWN_FIXES[ruleId]?.fix ?? null
}

/**
 * Given a list of rule IDs, splits them into:
 * - known: can be answered without Claude
 * - unknown: need Claude
 */
export function partitionByKnowledge(ruleIds: string[]): {
  known: string[]
  unknown: string[]
} {
  const known: string[] = []
  const unknown: string[] = []
  for (const id of ruleIds) {
    if (KNOWN_FIXES[id]) known.push(id)
    else unknown.push(id)
  }
  return { known, unknown }
}
