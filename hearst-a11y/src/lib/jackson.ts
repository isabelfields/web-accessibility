import JacksonLib from '@boxyhq/saml-jackson'
import type { IAdminController, IOAuthController, JacksonOption } from '@boxyhq/saml-jackson'
import { createPrivateKey, createPublicKey } from 'crypto'
import { neon } from '@neondatabase/serverless'

export interface JacksonInstance {
  oauthController: IOAuthController
  connectionAPIController: IAdminController
}

// Module-level singleton — re-used across hot reloads in dev, one per cold start in prod.
let _instance: JacksonInstance | null = null

// Delete any PKCS#1 RSA private keys Jackson stored in its internal table.
// Jackson 1.52.x requires PKCS#8 but older versions stored PKCS#1. On upgrade,
// Jackson loads the old key and fails with ERR_OSSL_UNSUPPORTED / "pkcs8" error.
// Deleting lets Jackson regenerate fresh PKCS#8-compatible keys on next use.
async function purgeLegacyJacksonKeys(dbUrl: string): Promise<void> {
  try {
    const sql = neon(dbUrl)
    await sql`
      DELETE FROM _jackson_store
      WHERE value::text LIKE '%BEGIN RSA PRIVATE KEY%'
    `
  } catch {
    // Table may not exist yet on first boot — ignore.
  }
}

export async function getJackson(): Promise<JacksonInstance> {
  if (_instance) return _instance

  const dbUrl = (process.env.JACKSON_DATABASE_URL || process.env.DATABASE_URL)!

  // One-time migration: remove any PKCS#1 signing keys so Jackson 1.52+ regenerates
  // them in PKCS#8 format compatible with Node 18+/OpenSSL 3.x.
  await purgeLegacyJacksonKeys(dbUrl)

  const opts: JacksonOption = {
    externalUrl: process.env.NEXTAUTH_URL!,
    // ACS URL — where Okta posts the SAMLResponse
    samlPath: '/api/auth/saml/callback',
    db: {
      engine: 'sql',
      type: 'postgres',
      url: dbUrl,
    },
    samlAudience: process.env.NEXTAUTH_URL!,
    // Must match the clientSecret in the NextAuth boxyhq-saml provider.
    clientSecretVerifier: process.env.JACKSON_CLIENT_SECRET || 'jackson-secret',
  }

  // Provide explicit PKCS#8 keys for OpenID JWT signing.
  // createPrivateKey/createPublicKey accept both PKCS#1 and PKCS#8 input and
  // normalize the output, so these work regardless of how the env vars were generated.
  if (process.env.JACKSON_PRIVATE_KEY && process.env.JACKSON_PUBLIC_KEY) {
    const rawPrivate = process.env.JACKSON_PRIVATE_KEY.replace(/\\n/g, '\n')
    const rawPublic = process.env.JACKSON_PUBLIC_KEY.replace(/\\n/g, '\n')
    const privateKeyPem = createPrivateKey(rawPrivate).export({ type: 'pkcs8', format: 'pem' }) as string
    const publicKeyPem = createPublicKey(rawPublic).export({ type: 'spki', format: 'pem' }) as string
    // Jackson's loadJWSPrivateKey/importJWTPublicKey do Buffer.from(key, 'base64').toString('ascii')
    // internally, so it expects the keys to be base64-encoded PEM strings, not raw PEM.
    opts.openid = {
      jwtSigningKeys: {
        private: Buffer.from(privateKeyPem).toString('base64'),
        public: Buffer.from(publicKeyPem).toString('base64'),
      },
    }
  }

  _instance = (await JacksonLib(opts)) as unknown as JacksonInstance
  return _instance
}

// Convenience constants — keep in sync with auth.ts provider config.
export const SAML_TENANT = 'hearst'
export const SAML_PRODUCT = 'hearst-a11y'
// Jackson client_id format: "tenant=X&product=Y"
export const SAML_CLIENT_ID = `tenant=${SAML_TENANT}&product=${SAML_PRODUCT}`
