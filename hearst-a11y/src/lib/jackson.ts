import JacksonLib from '@boxyhq/saml-jackson'
import type { IAdminController, IOAuthController, JacksonOption } from '@boxyhq/saml-jackson'

export interface JacksonInstance {
  oauthController: IOAuthController
  connectionAPIController: IAdminController
}

// Module-level singletons — re-used across hot reloads in dev, one per cold start in prod.
let _instance: JacksonInstance | null = null
let _jwsKeys: { private: string; public: string } | null = null

// Jackson (v1.x) reads JWT signing keys from opts.openid.jwtSigningKeys.
// The values must be base64-encoded PEM strings — Jackson base64-decodes them
// before calling jose.importPKCS8 / jose.importSPKI.
//
// In production set JACKSON_PRIVATE_KEY and JACKSON_PUBLIC_KEY to the raw PEM
// content (actual newlines are fine; escaped \n also accepted).  Without those
// env vars a fresh RSA-2048 pair is generated per process — fine for a single
// server, but in multi-instance / serverless deployments a /token response
// signed by instance A can't be verified by instance B's /userinfo.
async function getJWSKeys(): Promise<{ private: string; public: string }> {
  if (_jwsKeys) return _jwsKeys

  const pemToB64 = (pem: string) => Buffer.from(pem.replace(/\\n/g, '\n')).toString('base64')

  const priv = process.env.JACKSON_PRIVATE_KEY
  const pub = process.env.JACKSON_PUBLIC_KEY
  if (priv && pub) {
    _jwsKeys = { private: pemToB64(priv), public: pemToB64(pub) }
    return _jwsKeys
  }

  // Lazy import keeps this Node-only module out of client bundle analysis.
  const { generateKeyPairSync } = await import('node:crypto')
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  })
  _jwsKeys = {
    private: Buffer.from(privateKey as string).toString('base64'),
    public: Buffer.from(publicKey as string).toString('base64'),
  }
  return _jwsKeys
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
    openid: {
      jwsAlg: 'RS256',
      jwtSigningKeys: await getJWSKeys(),
    },
  } as any

  _instance = (await JacksonLib(opts)) as unknown as JacksonInstance
  return _instance
}

// Convenience constants — keep in sync with auth.ts provider config.
export const SAML_TENANT = 'hearst'
export const SAML_PRODUCT = 'hearst-a11y'
// Jackson client_id format: "tenant=X&product=Y"
export const SAML_CLIENT_ID = `tenant=${SAML_TENANT}&product=${SAML_PRODUCT}`
