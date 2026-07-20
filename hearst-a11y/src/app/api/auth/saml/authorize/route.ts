import { NextRequest, NextResponse } from 'next/server'
import { getJackson, SAML_TENANT, SAML_PRODUCT } from '@/lib/jackson'

// Keep redirect URLs in sync with the current NEXTAUTH_URL on every authorize attempt.
// This self-heals when the app is redeployed to a new URL (e.g. new Vercel deployment).
async function syncRedirectUrls(adminCtrl: any, connectionCtrl: any) {
  try {
    const base = process.env.NEXTAUTH_URL
    if (!base) return
    const result = await adminCtrl.getAllConnection()
    const conns: any[] = Array.isArray(result) ? result : (result?.data ?? [])
    for (const c of conns) {
      await connectionCtrl.updateSAMLConnection({
        clientID: c.clientID,
        clientSecret: c.clientSecret,
        tenant: SAML_TENANT,
        product: SAML_PRODUCT,
        defaultRedirectUrl: `${base}/api/auth/callback/boxyhq-saml`,
        redirectUrl: JSON.stringify([`${base}/*`]),
      })
    }
  } catch {
    // Non-fatal — proceed with authorize even if sync fails
  }
}

export async function GET(req: NextRequest) {
  try {
    const { oauthController, adminController, connectionAPIController } = await getJackson()
    await syncRedirectUrls(adminController, connectionAPIController)
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
