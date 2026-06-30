import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth-helpers'
import { sql } from '@/lib/db'
import { decryptToken, encryptToken, jiraIssueApiUrl, jiraUserKey, refreshJiraToken } from '@/lib/jira'

interface JiraProjectResult {
  key: string
  name: string
}

export async function GET() {
  const user = await getSessionUser()
  const userKey = jiraUserKey(user ?? {})
  if (!userKey) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [connection] = await sql`
    SELECT access_token, refresh_token, cloud_id, token_expires_at
    FROM jira_connections WHERE user_key = ${userKey}
  `
  if (!connection?.access_token || !connection?.cloud_id) {
    return NextResponse.json({ error: 'Connect Jira first.', code: 'jira_auth_required' }, { status: 401 })
  }

  let accessToken = decryptToken(connection.access_token)
  if (connection.token_expires_at && new Date(connection.token_expires_at).getTime() <= Date.now()) {
    if (!connection.refresh_token) {
      return NextResponse.json({ error: 'Reconnect Jira first.', code: 'jira_auth_required' }, { status: 401 })
    }
    const refreshed = await refreshJiraToken(decryptToken(connection.refresh_token))
    accessToken = refreshed.accessToken
    await sql`
      UPDATE jira_connections SET
        access_token = ${encryptToken(refreshed.accessToken)},
        refresh_token = ${refreshed.refreshToken ? encryptToken(refreshed.refreshToken) : connection.refresh_token},
        token_expires_at = ${refreshed.expiresAt.toISOString()},
        updated_at = NOW()
      WHERE user_key = ${userKey}
    `
  }

  const url = jiraIssueApiUrl({ cloudId: connection.cloud_id }).replace('/issue', '/project/search?orderBy=name')
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return NextResponse.json({ error: 'Could not load Jira projects', details: data }, { status: res.status })

  const projects = Array.isArray(data.values)
    ? data.values.map((project: any): JiraProjectResult => ({ key: project.key, name: project.name })).filter((project: JiraProjectResult) => project.key && project.name)
    : []
  return NextResponse.json({ projects })
}
