'use strict'

/**
 * Minimal jose-compatible shim using Node.js built-in crypto.
 * Implements only the subset consumed by @boxyhq/saml-jackson (RS256 JWTs).
 * Keys are represented as plain objects { pem, alg, type } rather than
 * WebCrypto CryptoKey objects — Jackson passes the value returned by
 * importPKCS8/importSPKI directly to SignJWT.sign/jwtVerify, so the
 * representation only needs to be consistent within this shim.
 */

const crypto = require('crypto')

function b64url(str) {
  return Buffer.from(str).toString('base64url')
}

function fromB64url(str) {
  return Buffer.from(str, 'base64url').toString('utf8')
}

async function importPKCS8(pem, alg) {
  return { pem, alg, type: 'private' }
}

async function importSPKI(pem, alg) {
  return { pem, alg, type: 'public' }
}

class SignJWT {
  constructor(payload) {
    this._payload = { ...payload }
    this._header = {}
  }

  setProtectedHeader(header) {
    this._header = { ...this._header, ...header }
    return this
  }

  setIssuedAt(iat) {
    this._payload.iat = iat !== undefined ? iat : Math.floor(Date.now() / 1000)
    return this
  }

  setExpirationTime(exp) {
    if (typeof exp === 'string') {
      const m = exp.match(/^(\d+)\s*(s|m|h|d|w)$/)
      if (m) {
        const mult = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 }
        this._payload.exp = Math.floor(Date.now() / 1000) + parseInt(m[1]) * mult[m[2]]
      }
    } else {
      this._payload.exp = exp
    }
    return this
  }

  setNotBefore(nbf) { this._payload.nbf = nbf; return this }
  setIssuer(iss) { this._payload.iss = iss; return this }
  setAudience(aud) { this._payload.aud = aud; return this }
  setSubject(sub) { this._payload.sub = sub; return this }
  setJti(jti) { this._payload.jti = jti; return this }

  async sign(key) {
    const header = b64url(JSON.stringify(this._header))
    const payload = b64url(JSON.stringify(this._payload))
    const data = `${header}.${payload}`
    const sig = crypto.createSign('RSA-SHA256')
    sig.update(data)
    return `${data}.${sig.sign(key.pem, 'base64url')}`
  }
}

async function jwtVerify(token, key, _options) {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid JWT')
  const [h, p, s] = parts
  const v = crypto.createVerify('RSA-SHA256')
  v.update(`${h}.${p}`)
  if (!v.verify(key.pem, s, 'base64url')) throw new Error('JWT signature invalid')
  const payload = JSON.parse(fromB64url(p))
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) throw new Error('JWT expired')
  return { payload, protectedHeader: JSON.parse(fromB64url(h)) }
}

function decodeJwt(token) {
  const parts = token.split('.')
  if (parts.length < 2) throw new Error('Invalid JWT')
  return JSON.parse(fromB64url(parts[1]))
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

module.exports = {
  SignJWT,
  importPKCS8,
  importSPKI,
  jwtVerify,
  decodeJwt,
  generateKeyPair,
}
