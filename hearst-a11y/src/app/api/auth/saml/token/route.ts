import { NextRequest, NextResponse } from 'next/server'
import { getJackson } from '@/lib/jackson'

// NextAuth calls this to exchange the authorization code for an access token.
export async function POST(req: NextRequest) {
  try {
    const { oauthController } = await getJackson()
    const body = Object.fromEntries((await req.formData()).entries()) as Record<string, string>

    // NextAuth sends client credentials in an HTTP Basic Auth header by default.
    // Jackson's token() expects them in the POST body — extract and inject.
    if (!body.client_secret) {
      const authHeader = req.headers.get('authorization') ?? ''
      const match = authHeader.match(/^Basic (.+)$/)
      if (match) {
        const decoded = Buffer.from(match[1], 'base64').toString('utf8')
        const colonIdx = decoded.indexOf(':')
        if (colonIdx !== -1) {
          // RFC 6749 §2.3.1: client_id and client_secret are URL-encoded in Basic Auth.
          body.client_id = body.client_id || decodeURIComponent(decoded.slice(0, colonIdx))
          body.client_secret = decodeURIComponent(decoded.slice(colonIdx + 1))
        }
      }
    }

    const token = await oauthController.token(body as any) as unknown as Record<string, unknown>
    // NextAuth uses type:'oauth' (oauthCallback) which rejects id_token in the response.
    // Strip it so NextAuth falls back to the userinfo endpoint for profile data.
    const { id_token: _dropped, ...rest } = token
    return NextResponse.json(rest)
  } catch (err: any) {
    console.error('[saml/token]', err)
    return NextResponse.json({ error: err?.message ?? 'token error' }, { status: 400 })
  }
}
