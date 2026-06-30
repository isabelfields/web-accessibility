import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth-helpers'
import { sql } from '@/lib/db'

export async function POST() {
  const user = await getSessionUser()
  if (!user?.id || user.id === '1') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await sql`
    UPDATE users SET
      jira_access_token = NULL,
      jira_refresh_token = NULL,
      jira_cloud_id = NULL,
      jira_site_url = NULL,
      jira_account_id = NULL,
      jira_token_expires_at = NULL
    WHERE id = ${user.id}
  `
  return NextResponse.json({ ok: true })
}
