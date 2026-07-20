import { NextResponse } from 'next/server'
import { getJackson, SAML_TENANT, SAML_PRODUCT } from '@/lib/jackson'

// Public diagnostic endpoint — no auth required.
// Visit /api/auth/saml/status to see what's failing with SSO.
export async function GET() {
  const nextAuthUrl = process.env.NEXTAUTH_URL ?? null
  const hasDb = !!(process.env.JACKSON_DATABASE_URL || process.env.DATABASE_URL)

  let jacksonOk = false
  let jacksonError: string | null = null
  let connections: { clientID: string; entityID: string | undefined; redirectUrl: string | undefined }[] = []

  try {
    const { connectionAPIController } = await getJackson()
    jacksonOk = true
    const conns = await (connectionAPIController as any).getAllConnection({ tenant: SAML_TENANT, product: SAML_PRODUCT })
    connections = (conns as any[]).map(c => ({
      clientID: c.clientID,
      entityID: c.idpMetadata?.entityID,
      redirectUrl: c.redirectUrl,
    }))
  } catch (err: any) {
    jacksonError = err?.message ?? String(err)
  }

  const expectedCallback = nextAuthUrl ? `${nextAuthUrl}/api/auth/callback/boxyhq-saml` : null

  return NextResponse.json({
    nextAuthUrl,
    hasDb,
    jacksonOk,
    jacksonError,
    connectionCount: connections.length,
    connections,
    expectedCallback,
  })
}
