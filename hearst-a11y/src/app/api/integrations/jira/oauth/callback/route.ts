import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth-helpers'
import { sql } from '@/lib/db'
import { chooseJiraResource, encryptToken, exchangeJiraCode, getJiraResources } from '@/lib/jira'

function redirectToApp(req: NextRequest, status: 'connected' | 'error', message?: string) {
  const url = new URL('/sites', req.url)
  url.searchParams.set('jira', status)
  if (message) url.searchParams.set('message', message)
  return NextResponse.redirect(url)
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user?.id || user.id === '1') return redirectToApp(req, 'error', 'Sign in with an invited user before connecting Jira.')

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
      UPDATE users SET
        jira_access_token = ${encryptToken(tokens.accessToken)},
        jira_refresh_token = ${tokens.refreshToken ? encryptToken(tokens.refreshToken) : null},
        jira_cloud_id = ${resource.id},
        jira_site_url = ${resource.url},
        jira_token_expires_at = ${tokens.expiresAt.toISOString()}
      WHERE id = ${user.id}
    `

    const res = redirectToApp(req, 'connected')
    res.cookies.delete('jira_oauth_state')
    return res
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not connect Jira.'
    return redirectToApp(req, 'error', message)
  }
}
