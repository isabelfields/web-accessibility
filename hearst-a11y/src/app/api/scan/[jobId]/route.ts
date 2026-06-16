import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getSessionUser, canAccessDivision } from '@/lib/auth-helpers'

type RouteContext = { params: Promise<{ jobId: string }> }

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { jobId } = await params

  // Scope deletion to the scan's parent site division. Ad-hoc scans (no
  // site_id) have no division owner, so any authenticated user may delete them.
  const [job] = await sql`
    SELECT s.division AS division, j.site_id AS site_id
    FROM scan_jobs j
    LEFT JOIN sites s ON s.id = j.site_id
    WHERE j.id = ${jobId}
  `
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (job.site_id && !canAccessDivision(user, job.division)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await sql`DELETE FROM scan_jobs WHERE id = ${jobId}`
  return NextResponse.json({ deleted: true })
}
