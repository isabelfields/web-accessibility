import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { neon } from '@neondatabase/serverless'
import { getSessionUser } from '@/lib/auth-helpers'

const ScheduleSchema = z.object({
  url: z.string().url(),
  cadence: z.enum(['daily', 'weekly', 'monthly']),
  dayOfWeek: z.number().min(0).max(6).optional(),
  dayOfMonth: z.number().min(1).max(31).optional(),
})

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
    // Clamp to the last day of the target month so e.g. day 31 doesn't roll
    // over into the following month (Feb -> 28/29, Apr/Jun/Sep/Nov -> 30).
    const lastDay = new Date(Date.UTC(y, mo + 2, 0)).getUTCDate()
    return new Date(Date.UTC(y, mo + 1, Math.min(targetDay, lastDay), 2, 0, 0, 0))
  }

  return new Date(Date.UTC(y, mo, d + 1, 2, 0, 0, 0))
}

export async function POST(req: NextRequest) {
  if (!(await getSessionUser())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = ScheduleSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { url, cadence, dayOfWeek, dayOfMonth } = parsed.data
  const nextRun = computeNextRun(cadence, dayOfWeek, dayOfMonth)
  const sql = neon(process.env.DATABASE_URL!)

  const [schedule] = await sql`
    INSERT INTO schedules (root_url, cadence, day_of_week, day_of_month, next_run_at)
    VALUES (${url}, ${cadence}, ${dayOfWeek ?? null}, ${dayOfMonth ?? null}, ${nextRun.toISOString()})
    RETURNING *
  `

  return NextResponse.json(schedule, { status: 201 })
}

export async function GET() {
  if (!(await getSessionUser())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sql = neon(process.env.DATABASE_URL!)
  const schedules = await sql`SELECT * FROM schedules ORDER BY created_at DESC`
  return NextResponse.json(schedules)
}

export async function DELETE(req: NextRequest) {
  if (!(await getSessionUser())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const sql = neon(process.env.DATABASE_URL!)
  await sql`DELETE FROM schedules WHERE id = ${id}`
  return NextResponse.json({ deleted: true })
}
