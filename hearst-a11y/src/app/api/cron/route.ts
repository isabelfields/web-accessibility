import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { startScan } from '@/lib/scan-job'
import { isValidBearer } from '@/lib/security'
import { computeNextRun } from '@/lib/schedule'

// Called by Vercel Cron daily at 02:00 UTC (vercel.json: "0 2 * * *"), matching
// the 02:00 next_run_at that computeNextRun sets — so due schedules fire that
// day. (Vercel Hobby plan only permits daily crons.)
// Finds all schedules whose next_run_at is due and triggers scans.
export async function GET(req: NextRequest) {
  // Vercel sends this header for cron jobs — reject other callers.
  // Constant-time compare; rejects outright if CRON_SECRET is unset.
  if (!isValidBearer(req.headers.get('authorization'), process.env.CRON_SECRET)) {
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
