import { NextRequest, NextResponse } from 'next/server'
import { getJackson, SAML_TENANT, SAML_PRODUCT } from '@/lib/jackson'
import { requireAdmin } from '@/lib/auth-helpers'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { connectionAPIController } = await getJackson()
  const ctrl = connectionAPIController as any
  const connections = await ctrl.getAllConnection({
    tenant: SAML_TENANT,
    product: SAML_PRODUCT,
  })
  return NextResponse.json(connections)
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
  const ctrl = connectionAPIController as any

  const payload: Record<string, string> = {
    tenant: SAML_TENANT,
    product: SAML_PRODUCT,
    defaultRedirectUrl: `${process.env.NEXTAUTH_URL}/api/auth/callback/boxyhq-saml`,
    redirectUrl: JSON.stringify([`${process.env.NEXTAUTH_URL}/*`]),
  }

  if (metadataXml) {
    // base64-encode the raw XML
    payload.encodedRawMetadata = Buffer.from(metadataXml).toString('base64')
  } else {
    payload.metadataUrl = metadataUrl
  }

  const connection = await ctrl.createSAMLConnection(payload)
  return NextResponse.json(connection, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { clientID } = await req.json()
  if (!clientID) return NextResponse.json({ error: 'clientID required' }, { status: 400 })

  const { connectionAPIController } = await getJackson()
  const ctrl = connectionAPIController as any
  await ctrl.deleteConnections({ clientID, tenant: SAML_TENANT, product: SAML_PRODUCT })
  return NextResponse.json({ ok: true })
}
