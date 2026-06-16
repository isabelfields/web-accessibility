import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { startScan } from '@/lib/scan-job'

// Called by Vercel Cron every hour (vercel.json: "0 * * * *").
// Finds all schedules whose next_run_at is due and triggers scans.
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
    // Run the scan in-process. Going through the HTTP API would be blocked by
    // the auth middleware (the cron request carries no session), so we call the
    // shared scan logic directly.
    const result = await startScan({
      url: schedule.root_url,
      scheduleId: schedule.id,
    })

    if (result.ok) {
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
  const y = now.getUTCFullYear()
  const mo = now.getUTCMonth()
  const d = now.getUTCDate()

  if (cadence === 'daily') {
    return new Date(Date.UTC(y, mo, d + 1, 2, 0, 0, 0))
  } else if (cadence === 'weekly') {
    const targetDay = dayOfWeek ?? 1
    const daysUntil = (targetDay - now.getUTCDay() + 7) % 7 || 7
    return new Date(Date.UTC(y, mo, d + daysUntil, 2, 0, 0, 0))
  } else if (cadence === 'monthly') {
    const targetDay = dayOfMonth ?? 1
    return new Date(Date.UTC(y, mo + 1, targetDay, 2, 0, 0, 0))
  }

  return new Date(Date.UTC(y, mo, d + 1, 2, 0, 0, 0))
}
