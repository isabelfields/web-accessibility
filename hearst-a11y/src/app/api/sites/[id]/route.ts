import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sql } from '@/lib/db'
import { getSessionUser, canAccessDivision } from '@/lib/auth-helpers'
import { findUnscannableUrl } from '@/lib/net/url-guard'

const SitePageSchema = z.object({
  url: z.string().url(),
  label: z.string(),
  templateType: z.enum(['homepage', 'article', 'gallery', 'category', 'commerce', 'video', 'search', 'other']),
})

const UpdateSiteSchema = z.object({
  name: z.string().min(1).optional(),
  division: z.string().optional(),
  brand: z.string().optional(),
  region: z.string().optional(),
  pages: z.array(SitePageSchema).min(1).optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const [site] = await sql`SELECT * FROM sites WHERE id = ${id}`
  // Return 404 (not 403) for sites outside the user's divisions so the
  // endpoint doesn't reveal the existence of sites they can't see.
  if (!site || !canAccessDivision(user, site.division)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const scans = await sql`
    SELECT id, score, status, pages_scanned, raw_violation_count,
           unique_pattern_count, estimated_cost_usd, started_at, completed_at, triggered_by
    FROM scan_jobs
    WHERE site_id = ${id}
    ORDER BY started_at DESC
    LIMIT 20
  `

  return NextResponse.json({ ...site, scanHistory: scans })
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = UpdateSiteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const [existing] = await sql`SELECT division FROM sites WHERE id = ${id}`
  if (!existing || !canAccessDivision(user, existing.division)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { name, division, brand, region, pages } = parsed.data

  // Don't let a user move a site into a division they can't access.
  if (division !== undefined && !canAccessDivision(user, division ?? null)) {
    return NextResponse.json({ error: 'Forbidden: division not allowed' }, { status: 403 })
  }

  // SSRF guard: validate any new page URLs before storing them.
  if (pages !== undefined) {
    const badUrl = await findUnscannableUrl(pages)
    if (badUrl) return NextResponse.json({ error: `Invalid page URL — ${badUrl}` }, { status: 400 })
  }

  const [site] = await sql`
    UPDATE sites SET
      name = COALESCE(${name ?? null}, name),
      division = CASE WHEN ${division !== undefined} THEN ${division ?? null} ELSE division END,
      brand = CASE WHEN ${brand !== undefined} THEN ${brand ?? null} ELSE brand END,
      region = CASE WHEN ${region !== undefined} THEN ${region ?? null} ELSE region END,
      pages = CASE WHEN ${pages !== undefined} THEN ${pages ? JSON.stringify(pages) : null}::jsonb ELSE pages END,
      updated_at = NOW()
    WHERE id = ${id} RETURNING *
  `
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(site)
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const [existing] = await sql`SELECT division FROM sites WHERE id = ${id}`
  if (!existing || !canAccessDivision(user, existing.division)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const [deleted] = await sql`
    WITH deleted_schedules AS (
      DELETE FROM schedules WHERE site_id = ${id} RETURNING id
    ),
    deleted_site AS (
      DELETE FROM sites WHERE id = ${id} RETURNING id
    )
    SELECT
      EXISTS(SELECT 1 FROM deleted_site) AS deleted,
      (SELECT COUNT(*)::int FROM deleted_schedules) AS schedules_deleted
  `

  return NextResponse.json({ deleted: Boolean(deleted?.deleted), schedulesDeleted: deleted?.schedules_deleted ?? 0 })
}
