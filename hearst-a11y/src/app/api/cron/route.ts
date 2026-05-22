import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

/**
 * Called by Vercel Cron every hour.
 * Finds all schedules whose next_run_at is in the past and triggers scans.
 *
 * Add to vercel.json:
 * {
 *   "crons": [{ "path": "/api/cron", "schedule": "0 * * * *" }]
 * }
 */
export async function GET(req: NextRequest) {
  // Vercel sends this header for cron jobs — reject other callers
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sql = neon(process.env.DATABASE_URL!)
  const now = new Date().toISOString()

  // Find schedules due to run
  const due = await sql`
    SELECT * FROM schedules
    WHERE enabled = true AND next_run_at <= ${now}
  `

  const triggered: string[] = []

  for (const schedule of due) {
    // Trigger a scan via the scan API
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: schedule.root_url, scheduleId: schedule.id }),
    })

    if (res.ok) {
      // Compute next run time
      const nextRun = computeNextRun(
        schedule.cadence,
        schedule.day_of_week,
        schedule.day_of_month
      )

      await sql`
        UPDATE schedules
        SET last_run_at = NOW(), next_run_at = ${nextRun.toISOString()}
        WHERE id = ${schedule.id}
      `

      triggered.push(schedule.id)
    }
  }

  return NextResponse.json({ triggered, count: triggered.length })
}

function computeNextRun(cadence: string, dayOfWeek?: number, dayOfMonth?: number): Date {
  const now = new Date()
  const next = new Date(now)

  if (cadence === 'daily') {
    next.setDate(now.getDate() + 1)
    next.setHours(2, 0, 0, 0)
  } else if (cadence === 'weekly') {
    const targetDay = dayOfWeek ?? 1
    const daysUntil = (targetDay - now.getDay() + 7) % 7 || 7
    next.setDate(now.getDate() + daysUntil)
    next.setHours(2, 0, 0, 0)
  } else if (cadence === 'monthly') {
    const targetDay = dayOfMonth ?? 1
    next.setMonth(now.getMonth() + 1)
    next.setDate(targetDay)
    next.setHours(2, 0, 0, 0)
  }

  return next
}
