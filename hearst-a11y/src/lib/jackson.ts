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

  // Jackson's loadJWSPrivateKey does Buffer.from(key, 'base64').toString('ascii')
  // then passes the result to jose.importPKCS8(). So we must supply a base64-encoded
  // PKCS#8 PEM string. If the env var is already a raw PEM, encode it once.
  // If it's already base64-encoded (or a PKCS1 key), the diagnostic below will show it.
  const normalizeToPkcs8B64 = (pem: string): string => {
    const cleaned = pem.replace(/\\n/g, '\n').trim()
    // If it already looks like base64 (not a PEM header), pass through as-is.
    if (!cleaned.startsWith('-----')) {
      console.log('[jackson] JACKSON_PRIVATE_KEY appears pre-encoded; using as-is')
      return cleaned
    }
    if (!cleaned.includes('BEGIN PRIVATE KEY')) {
      console.warn('[jackson] WARNING: JACKSON_PRIVATE_KEY is not PKCS#8 (missing "BEGIN PRIVATE KEY"). Got header:', cleaned.split('\n')[0])
    }
    return Buffer.from(cleaned).toString('base64')
  }

  const priv = process.env.JACKSON_PRIVATE_KEY
  const pub = process.env.JACKSON_PUBLIC_KEY
  console.log('[jackson] getJWSKeys: JACKSON_PRIVATE_KEY set?', !!priv, 'JACKSON_PUBLIC_KEY set?', !!pub)
  if (priv && pub) {
    const privB64 = normalizeToPkcs8B64(priv)
    const decoded = Buffer.from(privB64, 'base64').toString('ascii')
    console.log('[jackson] decoded private key prefix:', decoded.slice(0, 40))
    _jwsKeys = { private: privB64, public: normalizeToPkcs8B64(pub) }
    return _jwsKeys
  }

  // Lazy import keeps this Node-only module out of client bundle analysis.
  console.log('[jackson] getJWSKeys: auto-generating RSA-2048 keypair (set JACKSON_PRIVATE_KEY for stability)')
  const { generateKeyPairSync } = await import('node:crypto')
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  })
  const privStr = privateKey as string
  const pubStr = publicKey as string
  console.log('[jackson] generated private key prefix:', privStr.slice(0, 40))
  _jwsKeys = {
    private: Buffer.from(privStr).toString('base64'),
    public: Buffer.from(pubStr).toString('base64'),
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
