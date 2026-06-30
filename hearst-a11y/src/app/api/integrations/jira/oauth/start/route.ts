import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { getSessionUser } from '@/lib/auth-helpers'
import { buildJiraAuthorizeUrl, jiraOAuthConfigured } from '@/lib/jira'

function safeReturnTo(req: NextRequest): string {
  const value = new URL(req.url).searchParams.get('returnTo')
  if (!value) return '/sites'
  try {
    const url = new URL(value, req.url)
    if (url.origin !== new URL(req.url).origin) return '/sites'
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return '/sites'
  }
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!jiraOAuthConfigured()) {
    return NextResponse.json({ error: 'Jira OAuth is not configured. Set JIRA_CLIENT_ID, JIRA_CLIENT_SECRET, and JIRA_REDIRECT_URI.' }, { status: 503 })
  }

  const state = randomBytes(24).toString('base64url')
  const res = NextResponse.redirect(buildJiraAuthorizeUrl(state))
  res.cookies.set('jira_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 10 * 60,
  })
  res.cookies.set('jira_oauth_return_to', safeReturnTo(req), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 10 * 60,
  })
  return res
}
