import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth-helpers'
import { sql } from '@/lib/db'
import { jiraOAuthConfigured } from '@/lib/jira'

export async function GET() {
  const user = await getSessionUser()
  if (!user?.id || user.id === '1') return NextResponse.json({ connected: false, configured: jiraOAuthConfigured() })

  const [row] = await sql`SELECT jira_site_url FROM users WHERE id = ${user.id}`
  return NextResponse.json({ connected: Boolean(row?.jira_site_url), configured: jiraOAuthConfigured(), siteUrl: row?.jira_site_url ?? null })
}
