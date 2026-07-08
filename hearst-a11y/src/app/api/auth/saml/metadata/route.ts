import { NextRequest, NextResponse } from 'next/server'

// Returns the SP (Service Provider) metadata XML that Okta needs to configure the SAML app.
// Paste this URL into Okta's "Identity Provider metadata" field, or download and upload the XML.
export async function GET(req: NextRequest) {
  const base = process.env.NEXTAUTH_URL ?? `${req.nextUrl.protocol}//${req.nextUrl.host}`
  const entityId = `${base}/api/auth/saml/metadata`
  const acsUrl = `${base}/api/auth/saml/callback`

  const xml = `<?xml version="1.0"?>
<EntityDescriptor
  entityID="${entityId}"
  xmlns="urn:oasis:names:tc:SAML:2.0:metadata"
  xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
  xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">
  <SPSSODescriptor
    AuthnRequestsSigned="false"
    WantAssertionsSigned="true"
    protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>
    <AssertionConsumerService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${acsUrl}"
      index="0"
      isDefault="true"/>
  </SPSSODescriptor>
</EntityDescriptor>`

  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/xml' },
  })
}
