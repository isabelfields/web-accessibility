import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { neon } from '@neondatabase/serverless'

const ScheduleSchema = z.object({
  url: z.string().url(),
  cadence: z.enum(['daily', 'weekly', 'monthly']),
  dayOfWeek: z.number().min(0).max(6).optional(),
  dayOfMonth: z.number().min(1).max(31).optional(),
})

function computeNextRun(cadence: string, dayOfWeek?: number, dayOfMonth?: number): Date {
  const now = new Date()
  const next = new Date(now)

  if (cadence === 'daily') {
    next.setDate(now.getDate() + 1)
    next.setHours(2, 0, 0, 0) // 2am
  } else if (cadence === 'weekly') {
    const targetDay = dayOfWeek ?? 1 // Monday default
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

export async function POST(req: NextRequest) {
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
  const sql = neon(process.env.DATABASE_URL!)
  const schedules = await sql`SELECT * FROM schedules ORDER BY created_at DESC`
  return NextResponse.json(schedules)
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const sql = neon(process.env.DATABASE_URL!)
  await sql`DELETE FROM schedules WHERE id = ${id}`
  return NextResponse.json({ deleted: true })
}
