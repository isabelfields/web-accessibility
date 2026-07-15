import JacksonLib from '@boxyhq/saml-jackson'
import type { IAdminController, IOAuthController, JacksonOption } from '@boxyhq/saml-jackson'
import { createPrivateKey, createPublicKey } from 'crypto'

export interface JacksonInstance {
  oauthController: IOAuthController
  connectionAPIController: IAdminController
}

// Module-level singleton — re-used across hot reloads in dev, one per cold start in prod.
let _instance: JacksonInstance | null = null

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
    samlAudience: process.env.NEXTAUTH_URL!,
    // Must match the clientSecret in the NextAuth boxyhq-saml provider.
    clientSecretVerifier: process.env.JACKSON_CLIENT_SECRET || 'jackson-secret',
  }

  // Provide explicit PKCS#8 keys for OpenID JWT signing to avoid ERR_OSSL_UNSUPPORTED
  // on Node 18+/OpenSSL 3.x. Without these, Jackson auto-generates keys in PKCS#1 format
  // which OpenSSL 3.x rejects. Generate with: npm run generate-jackson-certs
  if (process.env.JACKSON_PRIVATE_KEY && process.env.JACKSON_PUBLIC_KEY) {
    const rawPrivate = process.env.JACKSON_PRIVATE_KEY.replace(/\\n/g, '\n')
    const rawPublic = process.env.JACKSON_PUBLIC_KEY.replace(/\\n/g, '\n')
    // Normalize to PKCS#8 regardless of whether the stored key is PKCS#1 or PKCS#8.
    // createPrivateKey accepts both formats; exporting as pkcs8 gives Jackson what it needs.
    const privateKey = createPrivateKey(rawPrivate).export({ type: 'pkcs8', format: 'pem' }) as string
    const publicKey = createPublicKey(rawPublic).export({ type: 'spki', format: 'pem' }) as string
    opts.openid = {
      jwtSigningKeys: { private: privateKey, public: publicKey },
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
