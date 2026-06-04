import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sql } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'

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
  const session = await getServerSession(authOptions)
  const isAdmin = (session?.user as any)?.role === 'admin'
  const allowedDivisions = isAdmin ? [] : ((session?.user as any)?.allowedDivisions ?? [])

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
  const body = await req.json()
  const parsed = SiteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { name, division, brand, region, pages } = parsed.data
  const [site] = await sql`
    INSERT INTO sites (name, division, brand, region, pages)
    VALUES (${name}, ${division ?? null}, ${brand ?? null}, ${region ?? null}, ${JSON.stringify(pages)})
    RETURNING *
  `
  return NextResponse.json(site, { status: 201 })
}
