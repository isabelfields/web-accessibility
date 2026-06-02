import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

type RouteContext = { params: Promise<{ jobId: string }> }

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { jobId } = await params
  await sql`DELETE FROM scan_jobs WHERE id = ${jobId}`
  return NextResponse.json({ deleted: true })
}
