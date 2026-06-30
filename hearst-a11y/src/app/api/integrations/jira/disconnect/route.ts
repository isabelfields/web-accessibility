import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth-helpers'
import { sql } from '@/lib/db'
import { jiraUserKey } from '@/lib/jira'

export async function POST() {
  const user = await getSessionUser()
  const userKey = jiraUserKey(user ?? {})
  if (!userKey) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await sql`DELETE FROM jira_connections WHERE user_key = ${userKey}`
  return NextResponse.json({ ok: true })
}
