import { NextRequest, NextResponse } from 'next/server'
import { getJackson } from '@/lib/jackson'

// NextAuth calls this to exchange the authorization code for an access token.
export async function POST(req: NextRequest) {
  try {
    const { oauthController } = await getJackson()
    const body = Object.fromEntries((await req.formData()).entries()) as Record<string, string>

    // NextAuth sends client credentials as HTTP Basic auth (client_secret_basic).
    // Jackson reads them from the request body, so extract and merge them in.
    const authHeader = req.headers.get('authorization') ?? ''
    if (authHeader.startsWith('Basic ')) {
      const decoded = Buffer.from(authHeader.slice(6), 'base64').toString()
      const sep = decoded.indexOf(':')
      if (sep !== -1) {
        const id = decodeURIComponent(decoded.slice(0, sep))
        const secret = decodeURIComponent(decoded.slice(sep + 1))
        if (id && !body.client_id) body.client_id = id
        if (secret && !body.client_secret) body.client_secret = secret
      }
    }

    const token = await oauthController.token(body as any)
    return NextResponse.json(token)
  } catch (err: any) {
    console.error('[saml/token]', err)
    return NextResponse.json({ error: err?.message ?? 'token error' }, { status: 400 })
  }
}
