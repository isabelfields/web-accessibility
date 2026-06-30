import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth-helpers'
import { sql } from '@/lib/db'
import { chooseJiraResource, encryptToken, exchangeJiraCode, getJiraResources, jiraUserKey } from '@/lib/jira'

function redirectToApp(req: NextRequest, status: 'connected' | 'error', message?: string) {
  const returnTo = req.cookies.get('jira_oauth_return_to')?.value ?? '/sites'
  const url = new URL(returnTo, req.url)
  url.searchParams.set('jira', status)
  if (message) url.searchParams.set('message', message)
  return NextResponse.redirect(url)
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  const userKey = jiraUserKey(user ?? {})
  if (!userKey) return redirectToApp(req, 'error', 'Sign in before connecting Jira.')

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const cookieState = req.cookies.get('jira_oauth_state')?.value
  if (!code || !state || !cookieState || state !== cookieState) return redirectToApp(req, 'error', 'Jira connection expired. Try again.')

  try {
    const tokens = await exchangeJiraCode(code)
    const resources = await getJiraResources(tokens.accessToken)
    const resource = chooseJiraResource(resources)
    if (!resource) return redirectToApp(req, 'error', 'No accessible Jira site matched this app configuration.')

    await sql`
      INSERT INTO jira_connections (user_key, access_token, refresh_token, cloud_id, site_url, token_expires_at, updated_at)
      VALUES (${userKey}, ${encryptToken(tokens.accessToken)}, ${tokens.refreshToken ? encryptToken(tokens.refreshToken) : null}, ${resource.id}, ${resource.url}, ${tokens.expiresAt.toISOString()}, NOW())
      ON CONFLICT (user_key) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        cloud_id = EXCLUDED.cloud_id,
        site_url = EXCLUDED.site_url,
        token_expires_at = EXCLUDED.token_expires_at,
        updated_at = NOW()
    `

    const res = redirectToApp(req, 'connected')
    res.cookies.delete('jira_oauth_state')
    res.cookies.delete('jira_oauth_return_to')
    return res
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not connect Jira.'
    return redirectToApp(req, 'error', message)
  }
}
