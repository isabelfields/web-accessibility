import JacksonLib from '@boxyhq/saml-jackson'
import type { IAdminController, IOAuthController, JacksonOption } from '@boxyhq/saml-jackson'

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
    // RS256 signing keys for Jackson to issue tokens. Set JACKSON_PRIVATE_KEY and
    // JACKSON_PUBLIC_KEY in Vercel env vars (PEM strings, newlines as \n).
    openid: {
      jwsAlg: 'RS256',
      jwtSigningKeys: {
        private: (process.env.JACKSON_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        public: (process.env.JACKSON_PUBLIC_KEY || '').replace(/\\n/g, '\n'),
      },
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
