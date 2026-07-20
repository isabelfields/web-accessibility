import { NextRequest, NextResponse } from 'next/server'
import { getJackson, SAML_TENANT, SAML_PRODUCT } from '@/lib/jackson'
import { requireAdmin } from '@/lib/auth-helpers'

// adminController.getAllConnection() returns { data: [...], pageToken }
async function listConnections(adminCtrl: any): Promise<any[]> {
  const result = await adminCtrl.getAllConnection()
  return Array.isArray(result) ? result : (result?.data ?? [])
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { adminController } = await getJackson()
  const connections = await listConnections(adminController)
  return NextResponse.json(connections)
}

// PATCH: update redirect URLs on an existing connection (fixes stale defaultRedirectUrl)
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { clientID } = await req.json()
  if (!clientID) return NextResponse.json({ error: 'clientID required' }, { status: 400 })

  const { connectionAPIController, adminController } = await getJackson()

  const conns = await listConnections(adminController)
  const match = conns.find((c: any) => c.clientID === clientID)
  if (!match) return NextResponse.json({ error: 'Connection not found' }, { status: 404 })

  await connectionAPIController.updateSAMLConnection({
    clientID,
    clientSecret: match.clientSecret,
    tenant: SAML_TENANT,
    product: SAML_PRODUCT,
    defaultRedirectUrl: `${process.env.NEXTAUTH_URL}/api/auth/callback/boxyhq-saml`,
    redirectUrl: JSON.stringify([`${process.env.NEXTAUTH_URL}/*`]),
  } as any)
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { metadataXml, metadataUrl } = body

  if (!metadataXml && !metadataUrl) {
    return NextResponse.json({ error: 'Provide either metadataXml or metadataUrl' }, { status: 400 })
  }

  const { connectionAPIController } = await getJackson()

  const payload: Record<string, string> = {
    tenant: SAML_TENANT,
    product: SAML_PRODUCT,
    defaultRedirectUrl: `${process.env.NEXTAUTH_URL}/api/auth/callback/boxyhq-saml`,
    redirectUrl: JSON.stringify([`${process.env.NEXTAUTH_URL}/*`]),
  }

  if (metadataXml) {
    payload.encodedRawMetadata = Buffer.from(metadataXml).toString('base64')
  } else {
    payload.metadataUrl = metadataUrl
  }

  const connection = await connectionAPIController.createSAMLConnection(payload as any)
  return NextResponse.json(connection, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { clientID } = await req.json()
  if (!clientID) return NextResponse.json({ error: 'clientID required' }, { status: 400 })

  const { connectionAPIController, adminController } = await getJackson()

  let clientSecret: string | undefined
  try {
    const conns = await listConnections(adminController)
    clientSecret = conns.find((c: any) => c.clientID === clientID)?.clientSecret
  } catch {
    // proceed without clientSecret
  }

  await (connectionAPIController as any).deleteConnections({
    clientID,
    ...(clientSecret ? { clientSecret } : {}),
    tenant: SAML_TENANT,
    product: SAML_PRODUCT,
  })
  return NextResponse.json({ ok: true })
}
