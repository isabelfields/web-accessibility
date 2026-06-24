import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sql } from '@/lib/db'
import { getSessionUser, canAccessDivision } from '@/lib/auth-helpers'

const TRIAGE_STATUSES = ['open', 'fixed', 'wontfix', 'false_positive'] as const

const UpsertSchema = z.object({
  siteId: z.string().uuid(),
  fingerprint: z.string().min(1),
  status: z.enum(TRIAGE_STATUSES),
  note: z.string().max(1000).optional(),
})

/** Confirms the user can access the site's division; returns the site or null. */
async function authorizeSite(siteId: string) {
  const user = await getSessionUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const [site] = await sql`SELECT division FROM sites WHERE id = ${siteId}`
  if (!site || !canAccessDivision(user, site.division)) return { error: 'Not found', status: 404 as const }
  return { user }
}

// GET /api/triage?siteId=... → { [fingerprint]: { status, note } }
export async function GET(req: NextRequest) {
  const siteId = new URL(req.url).searchParams.get('siteId')
  if (!siteId) return NextResponse.json({ error: 'Missing siteId' }, { status: 400 })

  const auth = await authorizeSite(siteId)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const rows = await sql`SELECT fingerprint, status, note FROM violation_triage WHERE site_id = ${siteId}`
  const map: Record<string, { status: string; note: string | null }> = {}
  for (const r of rows) map[r.fingerprint] = { status: r.status, note: r.note }
  return NextResponse.json(map)
}

// POST /api/triage → upsert a single pattern's triage state
export async function POST(req: NextRequest) {
  const parsed = UpsertSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const { siteId, fingerprint, status, note } = parsed.data

  const auth = await authorizeSite(siteId)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  await sql`
    INSERT INTO violation_triage (site_id, fingerprint, status, note, updated_by, updated_at)
    VALUES (${siteId}, ${fingerprint}, ${status}, ${note ?? null}, ${auth.user.email ?? ''}, NOW())
    ON CONFLICT (site_id, fingerprint)
    DO UPDATE SET status = ${status}, note = ${note ?? null}, updated_by = ${auth.user.email ?? ''}, updated_at = NOW()
  `
  return NextResponse.json({ ok: true })
}
