/**
 * OPTIMIZATION 1: Skip near-duplicate pages.
 *
 * Strategy: hash the structural skeleton of the DOM — tag names + ARIA roles +
 * landmark hierarchy — NOT text content or class names.
 *
 * Two article pages on cosmopolitan.com will have the same structure fingerprint
 * even though the headline, body copy, and images differ. We scan the first one
 * and skip the rest, since they share the same template and therefore the same
 * accessibility violations.
 */

/**
 * Given the full HTML string of a page, returns a short structural fingerprint.
 * Works in Node (via regex-based extraction, no DOM parser needed).
 *
 * The fingerprint captures:
 * - Landmark elements in order: header, nav, main, aside, footer
 * - Heading hierarchy: h1-h6 counts
 * - Form structure: number of form, input, select, textarea, button elements
 * - Image count
 * - Link count bucket (0, 1-10, 11-50, 51+)
 * - ARIA roles present (sorted, deduped)
 */
export function computeDomFingerprint(html: string): string {
  const lower = html.toLowerCase()

  // Landmark counts
  const landmarks = ['header', 'nav', 'main', 'aside', 'footer', 'section', 'article']
    .map(tag => {
      const count = (lower.match(new RegExp(`<${tag}[\\s>]`, 'g')) || []).length
      return `${tag}:${Math.min(count, 9)}` // cap at 9 to normalize
    })
    .join(',')

  // Heading hierarchy
  const headings = [1, 2, 3, 4, 5, 6]
    .map(n => {
      const count = (lower.match(new RegExp(`<h${n}[\\s>]`, 'g')) || []).length
      return `h${n}:${Math.min(count, 9)}`
    })
    .join(',')

  // Form elements
  const forms = ['form', 'input', 'select', 'textarea', 'button']
    .map(tag => {
      const count = (lower.match(new RegExp(`<${tag}[\\s>]`, 'g')) || []).length
      return `${tag}:${bucketCount(count)}`
    })
    .join(',')

  // Images (bucketed)
  const imgCount = (lower.match(/<img[\s>]/g) || []).length
  const images = `img:${bucketCount(imgCount)}`

  // Links (bucketed)
  const linkCount = (lower.match(/<a[\s>]/g) || []).length
  const links = `a:${bucketCount(linkCount)}`

  // ARIA roles present (sorted, deduped — catches modal patterns, tabs, etc.)
  const roleMatches = lower.matchAll(/role="([^"]+)"/g)
  const roles = [...new Set([...roleMatches].map(m => m[1]))].sort().join('|')

  const raw = [landmarks, headings, forms, images, links, `roles:${roles}`].join('__')

  // Simple but fast hash (djb2)
  return djb2(raw).toString(16)
}

function bucketCount(n: number): string {
  if (n === 0) return '0'
  if (n <= 5) return '1-5'
  if (n <= 20) return '6-20'
  if (n <= 50) return '21-50'
  return '50+'
}

function djb2(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
    hash = hash >>> 0 // keep as unsigned 32-bit
  }
  return hash
}

/**
 * Given a new page's fingerprint and a set of already-seen fingerprints,
 * returns whether this page is a near-duplicate.
 *
 * We also allow a small "family" threshold — if the fingerprint is
 * within 1 structural difference of a seen one, it's still a dupe.
 * For now we use exact match (simplest, most conservative).
 */
export function isNearDuplicate(
  fingerprint: string,
  seenFingerprints: Set<string>
): boolean {
  return seenFingerprints.has(fingerprint)
}
