/** Date/URL formatting helpers shared across pages and forms. */

/** "Jun 17, 2026, 02:00 PM" — full date with time. Returns "—" for null/undefined. */
export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

/** "Jun 17, 2026" — date only. Returns "—" for null/undefined. */
export function formatDay(d: string | Date | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Ensures a user-entered URL has an http(s) scheme, defaulting to https. */
export function normalizeUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return trimmed
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}
