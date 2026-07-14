import JacksonLib from '@boxyhq/saml-jackson'
import type { IAdminController, IOAuthController, JacksonOption } from '@boxyhq/saml-jackson'
import crypto from 'crypto'

export interface JacksonInstance {
  oauthController: IOAuthController
  connectionAPIController: IAdminController
}

// Module-level singleton — re-used across hot reloads in dev, one per cold start in prod.
let _instance: JacksonInstance | null = null

// Cache ephemeral keys at module level so they survive across getJackson() calls
// within the same process (though they won't survive process restarts).
let _ephemeralKeys: { private: string; public: string } | null = null

function getOpenidSigningKeys(): { private: string; public: string } {
  const privateKey = process.env.JACKSON_OPENID_RSA_PRIVATE_KEY
  const publicKey = process.env.JACKSON_OPENID_RSA_PUBLIC_KEY
  if (privateKey && publicKey) {
    return { private: privateKey, public: publicKey }
  }
  // Fallback: generate ephemeral RSA keys. Works for single-process deployments;
  // for multi-instance/serverless, set JACKSON_OPENID_RSA_PRIVATE_KEY and
  // JACKSON_OPENID_RSA_PUBLIC_KEY env vars (generate once with: openssl genrsa 2048).
  if (!_ephemeralKeys) {
    console.warn('[jackson] JACKSON_OPENID_RSA_PRIVATE_KEY not set — using ephemeral RSA keys. SSO sessions will not survive process restarts.')
    const { privateKey: priv, publicKey: pub } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    })
    _ephemeralKeys = { private: priv, public: pub }
  }
  return _ephemeralKeys
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
    samlAudience: process.env.NEXTAUTH_URL!,
    // Must match the clientSecret in the NextAuth boxyhq-saml provider.
    clientSecretVerifier: process.env.JACKSON_CLIENT_SECRET || 'jackson-secret',
    // RSA keys required by Jackson's OIDC bridge to sign id_tokens.
    openid: {
      jwtSigningKeys: getOpenidSigningKeys(),
    },
  }

  _instance = (await JacksonLib(opts)) as unknown as JacksonInstance
  return _instance
}

// Convenience constants — keep in sync with auth.ts provider config.
export const SAML_TENANT = 'hearst'
export const SAML_PRODUCT = 'hearst-a11y'
// Jackson client_id format: "tenant=X&product=Y"
export const SAML_CLIENT_ID = `tenant=${SAML_TENANT}&product=${SAML_PRODUCT}`
