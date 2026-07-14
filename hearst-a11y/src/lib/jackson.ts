import JacksonLib from '@boxyhq/saml-jackson'
import type { IAdminController, IOAuthController, JacksonOption } from '@boxyhq/saml-jackson'
import crypto from 'crypto'

export interface JacksonInstance {
  oauthController: IOAuthController
  connectionAPIController: IAdminController
}

let _instance: JacksonInstance | null = null
let _ephemeralKeys: { private: string; public: string } | null = null

function getOpenidSigningKeys(): { private: string; public: string } {
  const privateKey = process.env.JACKSON_OPENID_RSA_PRIVATE_KEY
  const publicKey = process.env.JACKSON_OPENID_RSA_PUBLIC_KEY
  if (privateKey && publicKey) return { private: privateKey, public: publicKey }
  // Ephemeral keys: fine for type:'oauth' because NextAuth doesn't verify the
  // id_token — it only uses the access_token to call userinfo. Keys don't need
  // to survive across Lambda instances for this flow.
  if (!_ephemeralKeys) {
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
    samlPath: '/api/auth/saml/callback',
    db: {
      engine: 'sql',
      type: 'postgres',
      url: (process.env.JACKSON_DATABASE_URL || process.env.DATABASE_URL)!,
    },
    samlAudience: process.env.NEXTAUTH_URL!,
    clientSecretVerifier: process.env.JACKSON_CLIENT_SECRET || 'jackson-secret',
    openid: {
      jwtSigningKeys: getOpenidSigningKeys(),
    },
  }

  _instance = (await JacksonLib(opts)) as unknown as JacksonInstance
  return _instance
}

export const SAML_TENANT = 'hearst'
export const SAML_PRODUCT = 'hearst-a11y'
export const SAML_CLIENT_ID = `tenant=${SAML_TENANT}&product=${SAML_PRODUCT}`
