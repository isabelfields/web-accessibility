import { NextRequest, NextResponse } from 'next/server'
import { getJackson } from '@/lib/jackson'

export async function GET(req: NextRequest) {
  try {
    const { oauthController } = await getJackson()
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const { redirect_url, authorize_form } = await oauthController.authorize(params as any)

    if (redirect_url) {
      return NextResponse.redirect(redirect_url)
    }

    // POST binding: return an auto-submitting HTML form
    if (authorize_form) {
      return new NextResponse(authorize_form, {
        headers: { 'Content-Type': 'text/html' },
      })
    }

    return NextResponse.json({ error: 'No redirect URL returned from Jackson' }, { status: 500 })
  } catch (err: any) {
    console.error('[saml/authorize]', err)
    const msg = err?.message ?? 'SAML authorize error'
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(msg)}`, req.nextUrl.origin)
    )
  }
}
