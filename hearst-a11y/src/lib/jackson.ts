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

  const privateKey = (process.env.JACKSON_OPENID_RSA_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  const publicKey = (process.env.JACKSON_OPENID_RSA_PUBLIC_KEY || '').replace(/\\n/g, '\n')
  console.log('[jackson] private key set:', privateKey.length > 0, '| public key set:', publicKey.length > 0)

  const opts: JacksonOption = {
    externalUrl: process.env.NEXTAUTH_URL!,
    samlPath: '/api/auth/saml/callback',
    db: {
      engine: 'sql',
      type: 'postgres',
      url: (process.env.JACKSON_DATABASE_URL || process.env.DATABASE_URL)!,
    },
    samlAudience: process.env.NEXTAUTH_URL!,
    clientSecretVerifier: process.env.JACKSON_CLIENT_SECRET || 'jackson-secret',
    openid: {
      jwsAlg: 'RS256',
      jwtSigningKeys: {
        private: privateKey,
        public: publicKey,
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
