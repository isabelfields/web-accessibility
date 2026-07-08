import { NextRequest, NextResponse } from 'next/server'
import { getJackson } from '@/lib/jackson'

// Okta posts the SAMLResponse here (HTTP-POST binding).
export async function POST(req: NextRequest) {
  try {
    const { oauthController } = await getJackson()
    const body = await req.formData()
    const SAMLResponse = body.get('SAMLResponse') as string
    const RelayState = body.get('RelayState') as string | undefined

    const { redirect_url } = await oauthController.samlResponse({
      SAMLResponse,
      RelayState,
    } as any)

    return NextResponse.redirect(redirect_url!, { status: 302 })
  } catch (err: any) {
    console.error('[saml/callback]', err)
    const msg = err?.message ?? 'SAML callback error'
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(msg)}`, req.nextUrl.origin)
    )
  }
}
