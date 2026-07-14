import { NextRequest, NextResponse } from 'next/server'
import { getJackson } from '@/lib/jackson'

// NextAuth calls this to exchange the authorization code for an access token.
// NextAuth sends client credentials via HTTP Basic Auth (RFC 6749 §2.3.1) rather
// than in the POST body. Jackson only reads the body, so we decode the
// Authorization header and merge client_id / client_secret into the body params.
export async function POST(req: NextRequest) {
  try {
    const { oauthController } = await getJackson()
    const body: Record<string, string> = Object.fromEntries((await req.formData()).entries() as any)

    const authHeader = req.headers.get('authorization') ?? ''
    if (authHeader.startsWith('Basic ')) {
      const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8')
      const sep = decoded.indexOf(':')
      if (sep !== -1) {
        body.client_id     ??= decodeURIComponent(decoded.slice(0, sep))
        body.client_secret ??= decodeURIComponent(decoded.slice(sep + 1))
      }
    }

    const token = await oauthController.token(body as any)
    return NextResponse.json(token)
  } catch (err: any) {
    console.error('[saml/token]', err)
    return NextResponse.json({ error: err?.message ?? 'token error' }, { status: 400 })
  }
}
