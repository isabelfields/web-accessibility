import { NextRequest, NextResponse } from 'next/server'
import { getJackson } from '@/lib/jackson'

// NextAuth calls this with the access token to retrieve the user profile.
export async function GET(req: NextRequest) {
  try {
    const { oauthController } = await getJackson()
    const auth = req.headers.get('authorization') ?? ''
    const token = auth.replace(/^Bearer\s+/i, '')
    const profile = await oauthController.userInfo(token)
    console.log('[saml/userinfo] profile:', JSON.stringify(profile))
    return NextResponse.json(profile)
  } catch (err: any) {
    console.error('[saml/userinfo]', err)
    return NextResponse.json({ error: err?.message ?? 'userinfo error' }, { status: 401 })
  }
}
