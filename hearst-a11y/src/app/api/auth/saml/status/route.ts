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
    const { adminController } = await getJackson()
    jacksonOk = true
    const result = await (adminController as any).getAllConnection()
    const conns = Array.isArray(result) ? result : (result?.data ?? [])
    connections = conns.map((c: any) => ({
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
