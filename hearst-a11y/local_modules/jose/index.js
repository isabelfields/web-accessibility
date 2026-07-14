'use strict'

/**
 * Vendored jose shim — implements the subset used by @boxyhq/saml-jackson and
 * next-auth using Node.js built-in crypto + zlib. No external dependencies.
 *
 * Supported algorithms:
 *   JWS: RS256 (for SAML token signing via SignJWT/jwtVerify)
 *   JWE: dir + A256GCM, dir + A256CBC-HS512 (for next-auth session encoding)
 *   Compression: DEF (deflate-raw), as used by next-auth
 */

const crypto = require('crypto')
const zlib = require('zlib')

// ── helpers ───────────────────────────────────────────────────────────────────

function b64u(data) {
  return Buffer.from(data).toString('base64url')
}

function fromb64u(str) {
  return Buffer.from(str, 'base64url')
}

function toKeyBuf(key) {
  if (Buffer.isBuffer(key)) return key
  if (key instanceof Uint8Array) return Buffer.from(key)
  if (typeof key === 'string') return Buffer.from(key)
  if (key && key.pem) return key.pem   // our RSA key object
  return key
}

function parseDuration(exp) {
  if (typeof exp !== 'string') return exp
  const m = exp.match(/^(\d+)\s*(s|m|h|d|w)$/)
  if (!m) return Number(exp)
  const mult = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 }
  return Math.floor(Date.now() / 1000) + parseInt(m[1]) * mult[m[2]]
}

// ── key imports (RSA — returns plain objects used by SignJWT/jwtVerify) ───────

async function importPKCS8(pem, alg) {
  return { pem, alg, type: 'private' }
}

async function importSPKI(pem, alg) {
  return { pem, alg, type: 'public' }
}

async function importX509(pem, alg) {
  // Extract public key from X.509 cert using Node crypto
  const cert = new crypto.X509Certificate(pem)
  return { pem: cert.publicKey.export({ type: 'spki', format: 'pem' }), alg, type: 'public' }
}

// ── JWS — SignJWT / jwtVerify (RS256) ─────────────────────────────────────────

class SignJWT {
  constructor(payload) {
    this._payload = { ...payload }
    this._header = {}
  }

  setProtectedHeader(h) { this._header = { ...this._header, ...h }; return this }
  setIssuedAt(iat) { this._payload.iat = iat !== undefined ? iat : Math.floor(Date.now() / 1000); return this }
  setExpirationTime(exp) { this._payload.exp = parseDuration(exp); return this }
  setNotBefore(nbf) { this._payload.nbf = nbf; return this }
  setIssuer(iss) { this._payload.iss = iss; return this }
  setAudience(aud) { this._payload.aud = aud; return this }
  setSubject(sub) { this._payload.sub = sub; return this }
  setJti(jti) { this._payload.jti = jti; return this }

  async sign(key) {
    const header = b64u(JSON.stringify(this._header))
    const payload = b64u(JSON.stringify(this._payload))
    const data = `${header}.${payload}`
    const sig = crypto.createSign('RSA-SHA256')
    sig.update(data)
    return `${data}.${sig.sign(key.pem, 'base64url')}`
  }
}

async function jwtVerify(token, key, _opts) {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid JWT')
  const [h, p, s] = parts
  const v = crypto.createVerify('RSA-SHA256')
  v.update(`${h}.${p}`)
  if (!v.verify(key.pem, s, 'base64url')) throw new Error('JWT signature invalid')
  const payload = JSON.parse(fromb64u(p).toString())
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) throw new Error('JWT expired')
  return { payload, protectedHeader: JSON.parse(fromb64u(h).toString()) }
}

// ── JWE — EncryptJWT / jwtDecrypt (dir + A256GCM or A256CBC-HS512) ───────────

class EncryptJWT {
  constructor(payload) {
    this._payload = { ...payload }
    this._header = {}
  }

  setProtectedHeader(h) { this._header = { ...this._header, ...h }; return this }
  setIssuedAt(iat) { this._payload.iat = iat !== undefined ? iat : Math.floor(Date.now() / 1000); return this }
  setExpirationTime(exp) { this._payload.exp = parseDuration(exp); return this }
  setNotBefore(nbf) { this._payload.nbf = nbf; return this }
  setIssuer(iss) { this._payload.iss = iss; return this }
  setAudience(aud) { this._payload.aud = aud; return this }
  setSubject(sub) { this._payload.sub = sub; return this }
  setJti(jti) { this._payload.jti = jti; return this }

  async encrypt(key) {
    const enc = this._header.enc || 'A256GCM'
    const zip = this._header.zip

    let plaintext = Buffer.from(JSON.stringify(this._payload))
    if (zip === 'DEF') plaintext = zlib.deflateRawSync(plaintext)

    const headerStr = b64u(JSON.stringify(this._header))
    const aad = Buffer.from(headerStr, 'ascii')
    const keyBuf = toKeyBuf(key)

    if (enc === 'A256GCM') {
      const iv = crypto.randomBytes(12)
      const cipher = crypto.createCipheriv('aes-256-gcm', keyBuf.slice(0, 32), iv)
      cipher.setAAD(aad)
      const ct = Buffer.concat([cipher.update(plaintext), cipher.final()])
      const tag = cipher.getAuthTag()
      return `${headerStr}..${iv.toString('base64url')}.${ct.toString('base64url')}.${tag.toString('base64url')}`
    }

    if (enc === 'A256CBC-HS512') {
      // RFC 7518 §5.2.2: 512-bit key, first 256 bits = MAC key, last 256 bits = ENC key
      const macKey = keyBuf.slice(0, 32)
      const encKey = keyBuf.slice(32, 64)
      const iv = crypto.randomBytes(16)
      const cipher = crypto.createCipheriv('aes-256-cbc', encKey, iv)
      const ct = Buffer.concat([cipher.update(plaintext), cipher.final()])

      // AL = 64-bit big-endian bit-length of the ASCII AAD
      const al = Buffer.alloc(8)
      al.writeBigUInt64BE(BigInt(aad.length * 8))
      const hmac = crypto.createHmac('sha512', macKey)
      hmac.update(aad); hmac.update(iv); hmac.update(ct); hmac.update(al)
      const tag = hmac.digest().slice(0, 32) // truncate to T_LEN = 256 bits

      return `${headerStr}..${iv.toString('base64url')}.${ct.toString('base64url')}.${tag.toString('base64url')}`
    }

    throw new Error(`Unsupported JWE enc: ${enc}`)
  }
}

async function jwtDecrypt(token, key, _opts) {
  const parts = token.split('.')
  if (parts.length !== 5) throw new Error('Invalid JWE compact serialization')
  const [headerB64, , ivB64, ctB64, tagB64] = parts

  const protectedHeader = JSON.parse(fromb64u(headerB64).toString())
  const enc = protectedHeader.enc || 'A256GCM'
  const zip = protectedHeader.zip
  const iv = fromb64u(ivB64)
  const ct = fromb64u(ctB64)
  const tag = fromb64u(tagB64)
  const aad = Buffer.from(headerB64, 'ascii')
  const keyBuf = toKeyBuf(key)

  let plaintext

  if (enc === 'A256GCM') {
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf.slice(0, 32), iv)
    decipher.setAAD(aad)
    decipher.setAuthTag(tag)
    plaintext = Buffer.concat([decipher.update(ct), decipher.final()])
  } else if (enc === 'A256CBC-HS512') {
    const macKey = keyBuf.slice(0, 32)
    const encKey = keyBuf.slice(32, 64)
    const al = Buffer.alloc(8)
    al.writeBigUInt64BE(BigInt(aad.length * 8))
    const hmac = crypto.createHmac('sha512', macKey)
    hmac.update(aad); hmac.update(iv); hmac.update(ct); hmac.update(al)
    const expectedTag = hmac.digest().slice(0, 32)
    if (!crypto.timingSafeEqual(tag, expectedTag)) throw new Error('JWE integrity check failed')
    const decipher = crypto.createDecipheriv('aes-256-cbc', encKey, iv)
    plaintext = Buffer.concat([decipher.update(ct), decipher.final()])
  } else {
    throw new Error(`Unsupported JWE enc: ${enc}`)
  }

  if (zip === 'DEF') plaintext = zlib.inflateRawSync(plaintext)

  const payload = JSON.parse(plaintext.toString('utf8'))
  return { payload, protectedHeader }
}

// ── utilities ─────────────────────────────────────────────────────────────────

function decodeJwt(token) {
  const parts = token.split('.')
  if (parts.length < 2) throw new Error('Invalid JWT')
  return JSON.parse(fromb64u(parts[1]).toString())
}

async function calculateJwkThumbprint(jwk, digestAlg) {
  const alg = (digestAlg || 'sha256').replace('sha', 'sha')
  const members = Object.keys(jwk).sort().reduce((o, k) => { o[k] = jwk[k]; return o }, {})
  return crypto.createHash(alg).update(JSON.stringify(members)).digest('base64url')
}

async function generateKeyPair(alg, options) {
  return new Promise((resolve, reject) => {
    crypto.generateKeyPair('rsa', {
      modulusLength: (options && options.modulusLength) || 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    }, (err, publicKey, privateKey) => {
      if (err) return reject(err)
      resolve({
        privateKey: { pem: privateKey, alg, type: 'private' },
        publicKey: { pem: publicKey, alg, type: 'public' },
      })
    })
  })
}

const base64url = {
  encode(data) {
    return Buffer.from(data).toString('base64url')
  },
  decode(str) {
    return new Uint8Array(fromb64u(typeof str === 'string' ? str : Buffer.from(str).toString()))
  },
}

// ── exports ───────────────────────────────────────────────────────────────────

module.exports = {
  SignJWT,
  EncryptJWT,
  importPKCS8,
  importSPKI,
  importX509,
  jwtVerify,
  jwtDecrypt,
  decodeJwt,
  calculateJwkThumbprint,
  generateKeyPair,
  base64url,
}
