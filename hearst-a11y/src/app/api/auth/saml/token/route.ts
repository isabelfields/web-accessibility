import { NextRequest, NextResponse } from 'next/server'
import { getJackson } from '@/lib/jackson'

// NextAuth calls this to exchange the authorization code for an access token.
export async function POST(req: NextRequest) {
  try {
    const { oauthController } = await getJackson()
    const body = Object.fromEntries((await req.formData()).entries())
    const token = await oauthController.token(body as any)
    return NextResponse.json(token)
  } catch (err: any) {
    console.error('[saml/token]', err)
    return NextResponse.json({ error: err?.message ?? 'token error' }, { status: 400 })
  }
}
