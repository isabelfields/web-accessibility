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


/** "Jun 17" — compact chart tick date. */
export function formatChartDay(d: string | Date): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** "Jun 17, 2026" — chart tooltip date. */
export function formatChartDate(d: string | Date): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** "Jun '26" — compact year-month label for usage charts. */
export function formatYearMonth(ym: string): string {
  const [year, month] = ym.split('-')
  return new Date(Number(year), Number(month) - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

/** Formats fractional API cost values without hiding non-zero sub-cent spend. */
export function formatCurrency(cost: number): string {
  return cost > 0 && cost < 0.01 ? '<$0.01' : `$${cost.toFixed(2)}`
}
