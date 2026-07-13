import JacksonLib from '@boxyhq/saml-jackson'
import type { IAdminController, IOAuthController, JacksonOption } from '@boxyhq/saml-jackson'

export interface JacksonInstance {
  oauthController: IOAuthController
  connectionAPIController: IAdminController
}

// Module-level singleton — re-used across hot reloads in dev, one per cold start in prod.
let _instance: JacksonInstance | null = null
let _certs: { privateKey: string; publicKey: string } | null = null

// Jackson requires an RSA key pair to sign the JWTs it issues during the
// internal OIDC bridge (SAML → OAuth → NextAuth).  Provide JACKSON_PRIVATE_KEY
// and JACKSON_PUBLIC_KEY (PEM, with literal \n for newlines) in production so
// the same keys are used across all instances / restarts.  Without them a new
// pair is generated on first use; that works on a single server but causes
// token-validation failures when /token and /userinfo land on different
// serverless instances.
async function getCerts(): Promise<{ privateKey: string; publicKey: string }> {
  if (_certs) return _certs
  const priv = process.env.JACKSON_PRIVATE_KEY
  const pub = process.env.JACKSON_PUBLIC_KEY
  if (priv && pub) {
    _certs = { privateKey: priv.replace(/\\n/g, '\n'), publicKey: pub.replace(/\\n/g, '\n') }
    return _certs
  }
  // Lazy import keeps this Node-only code out of any client bundle analysis.
  const { generateKeyPairSync } = await import('node:crypto')
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  })
  _certs = { privateKey: privateKey as string, publicKey: publicKey as string }
  return _certs
}

export async function getJackson(): Promise<JacksonInstance> {
  if (_instance) return _instance

  const opts: JacksonOption = {
    externalUrl: process.env.NEXTAUTH_URL!,
    // ACS URL — where Okta posts the SAMLResponse
    samlPath: '/api/auth/saml/callback',
    db: {
      engine: 'sql',
      type: 'postgres',
      // Use the standard pooler connection string, not the Neon HTTP URL.
      // Set JACKSON_DATABASE_URL to your Neon pooler URL if it differs from DATABASE_URL.
      url: (process.env.JACKSON_DATABASE_URL || process.env.DATABASE_URL)!,
    },
    samlAudience: `${process.env.NEXTAUTH_URL}/api/auth/saml/metadata`,
    // Must match the clientSecret in the NextAuth boxyhq-saml provider.
    clientSecretVerifier: process.env.JACKSON_CLIENT_SECRET || 'jackson-secret',
    certs: await getCerts(),
  }

  _instance = (await JacksonLib(opts)) as unknown as JacksonInstance
  return _instance
}

// Convenience constants — keep in sync with auth.ts provider config.
export const SAML_TENANT = 'hearst'
export const SAML_PRODUCT = 'hearst-a11y'
// Jackson client_id format: "tenant=X&product=Y"
export const SAML_CLIENT_ID = `tenant=${SAML_TENANT}&product=${SAML_PRODUCT}`
