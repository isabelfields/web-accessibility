import { NextRequest, NextResponse } from 'next/server'
import { getJackson } from '@/lib/jackson'

// NextAuth calls this to exchange the authorization code for an access token.
// NextAuth sends client credentials via HTTP Basic auth (Authorization header),
// but Jackson expects them in the POST body — merge them before passing to Jackson.
export async function POST(req: NextRequest) {
  try {
    const { oauthController } = await getJackson()
    const body: Record<string, string> = Object.fromEntries((await req.formData()).entries()) as Record<string, string>

    const authHeader = req.headers.get('authorization')
    if (authHeader?.startsWith('Basic ')) {
      const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8')
      const colon = decoded.indexOf(':')
      if (colon !== -1) {
        body.client_id = body.client_id || decoded.slice(0, colon)
        body.client_secret = body.client_secret || decoded.slice(colon + 1)
      }
    }

    const token = await oauthController.token(body as any)
    return NextResponse.json(token)
  } catch (err: any) {
    console.error('[saml/token]', err)
    return NextResponse.json({ error: err?.message ?? 'token error' }, { status: 400 })
  }
}
