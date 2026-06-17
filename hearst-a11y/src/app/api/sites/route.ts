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

const SiteSchema = z.object({
  name: z.string().min(1),
  division: z.string().optional(),
  brand: z.string().optional(),
  region: z.string().optional(),
  pages: z.array(SitePageSchema).min(1),
})

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdmin = user.role === 'admin'
  const allowedDivisions = isAdmin ? [] : (user.allowedDivisions ?? [])

  const sites = allowedDivisions.length > 0
    ? await sql`SELECT * FROM sites WHERE division = ANY(${allowedDivisions}::text[]) ORDER BY created_at DESC`
    : await sql`SELECT * FROM sites ORDER BY created_at DESC`

  const enriched = await Promise.all(
    sites.map(async (site: any) => {
      const [latest] = await sql`
        SELECT status, started_at, unique_pattern_count, raw_violation_count, patterns
        FROM scan_jobs
        WHERE site_id = ${site.id} AND status = 'complete'
        ORDER BY started_at DESC
        LIMIT 1
      `
      return { ...site, latestScan: latest ?? null }
    })
  )

  return NextResponse.json(enriched)
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = SiteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { name, division, brand, region, pages } = parsed.data

  // A user may only create sites within a division they can access.
  if (!canAccessDivision(user, division ?? null)) {
    return NextResponse.json({ error: 'Forbidden: division not allowed' }, { status: 403 })
  }

  const badUrl = await findUnscannableUrl(pages)
  if (badUrl) return NextResponse.json({ error: `Invalid page URL — ${badUrl}` }, { status: 400 })

  const [site] = await sql`
    INSERT INTO sites (name, division, brand, region, pages)
    VALUES (${name}, ${division ?? null}, ${brand ?? null}, ${region ?? null}, ${JSON.stringify(pages)})
    RETURNING *
  `
  return NextResponse.json(site, { status: 201 })
}
