import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { neon } from '@neondatabase/serverless'
import { getSessionUser, canAccessDivision } from '@/lib/auth-helpers'
import { assertPublicUrl, UrlNotAllowedError } from '@/lib/net/url-guard'
import { computeNextRun } from '@/lib/schedule'

const ScheduleSchema = z.object({
  url: z.string().url().optional(),
  siteId: z.string().uuid().optional(),
  cadence: z.enum(['daily', 'weekly', 'monthly']),
  dayOfWeek: z.number().min(0).max(6).optional(),
  dayOfMonth: z.number().min(1).max(31).optional(),
}).refine(data => data.url || data.siteId, {
  message: 'Either url or siteId is required',
})

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = ScheduleSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { cadence, dayOfWeek, dayOfMonth, siteId } = parsed.data
  const sql = neon(process.env.DATABASE_URL!)

  let scheduleUrl = parsed.data.url
  if (siteId) {
    const [site] = await sql`SELECT division, pages FROM sites WHERE id = ${siteId}`
    if (!site || !canAccessDivision(user, site.division)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    scheduleUrl = (site.pages as { url: string }[])[0]?.url ?? scheduleUrl
  }
  if (!scheduleUrl) return NextResponse.json({ error: 'Site has no URL to schedule' }, { status: 400 })

  // SSRF guard: don't persist a schedule that points at a non-public target.
  try {
    await assertPublicUrl(scheduleUrl)
  } catch (e) {
    if (e instanceof UrlNotAllowedError) return NextResponse.json({ error: e.message }, { status: 400 })
    throw e
  }

  const nextRun = computeNextRun(cadence, dayOfWeek, dayOfMonth)

  const [schedule] = await sql`
    INSERT INTO schedules (root_url, site_id, cadence, day_of_week, day_of_month, next_run_at)
    VALUES (${scheduleUrl}, ${siteId ?? null}, ${cadence}, ${dayOfWeek ?? null}, ${dayOfMonth ?? null}, ${nextRun.toISOString()})
    RETURNING *
  `

  return NextResponse.json(schedule, { status: 201 })
}

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sql = neon(process.env.DATABASE_URL!)
  const rows = await sql`
    SELECT schedules.*, sites.division AS site_division
    FROM schedules
    LEFT JOIN sites ON sites.id = schedules.site_id
    ORDER BY schedules.created_at DESC
  `
  const schedules = rows
    .filter(schedule => !schedule.site_id || canAccessDivision(user, schedule.site_division))
    .map(({ site_division, ...schedule }) => schedule)

  return NextResponse.json(schedules)
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const sql = neon(process.env.DATABASE_URL!)
  const [schedule] = await sql`
    SELECT schedules.id, schedules.site_id, sites.division AS site_division
    FROM schedules
    LEFT JOIN sites ON sites.id = schedules.site_id
    WHERE schedules.id = ${id}
  `
  if (!schedule || (schedule.site_id && !canAccessDivision(user, schedule.site_division))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await sql`DELETE FROM schedules WHERE id = ${id}`
  return NextResponse.json({ deleted: true })
}
