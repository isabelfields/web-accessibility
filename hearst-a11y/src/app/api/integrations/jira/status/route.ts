import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth-helpers'
import { sql } from '@/lib/db'
import { jiraOAuthConfigured, jiraUserKey } from '@/lib/jira'

export async function GET() {
  const user = await getSessionUser()
  const userKey = jiraUserKey(user ?? {})
  if (!userKey) return NextResponse.json({ connected: false, configured: jiraOAuthConfigured() })

  const [row] = await sql`SELECT site_url FROM jira_connections WHERE user_key = ${userKey}`
  return NextResponse.json({ connected: Boolean(row?.site_url), configured: jiraOAuthConfigured(), siteUrl: row?.site_url ?? null })
}
