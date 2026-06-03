import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sql } from '@/lib/db'

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
  const { id } = await params
  const [site] = await sql`SELECT * FROM sites WHERE id = ${id}`
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

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
  const { id } = await params
  const body = await req.json()
  const parsed = UpdateSiteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { name, division, brand, region, pages } = parsed.data

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
  const { id } = await params
  await sql`DELETE FROM sites WHERE id = ${id}`
  return NextResponse.json({ deleted: true })
}
