export type Cadence = 'daily' | 'weekly' | 'monthly'

/**
 * Computes the next run time (02:00 UTC) for a schedule, given its cadence.
 * Shared by the schedules API (initial run) and the cron job (subsequent runs).
 *
 * - daily: tomorrow
 * - weekly: next occurrence of dayOfWeek (0-6), at least a day out
 * - monthly: dayOfMonth this month if still ahead, else next month; the day is
 *   clamped to each month's last day so e.g. 31 doesn't roll over.
 */
export function computeNextRun(cadence: string, dayOfWeek?: number, dayOfMonth?: number): Date {
  const now = new Date()
  const y = now.getUTCFullYear()
  const mo = now.getUTCMonth()
  const d = now.getUTCDate()

  if (cadence === 'weekly') {
    const targetDay = dayOfWeek ?? 1
    const daysUntil = (targetDay - now.getUTCDay() + 7) % 7 || 7
    return new Date(Date.UTC(y, mo, d + daysUntil, 2, 0, 0, 0))
  }

  if (cadence === 'monthly') {
    const targetDay = dayOfMonth ?? 1
    const thisMonthLast = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate()
    const thisMonth = new Date(Date.UTC(y, mo, Math.min(targetDay, thisMonthLast), 2, 0, 0, 0))
    if (thisMonth.getTime() > now.getTime()) return thisMonth
    const nextMonthLast = new Date(Date.UTC(y, mo + 2, 0)).getUTCDate()
    return new Date(Date.UTC(y, mo + 1, Math.min(targetDay, nextMonthLast), 2, 0, 0, 0))
  }

  // daily (and default)
  return new Date(Date.UTC(y, mo, d + 1, 2, 0, 0, 0))
}
