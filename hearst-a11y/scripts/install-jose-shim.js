'use strict'

/**
 * Installs our minimal jose shim into @boxyhq/saml-jackson's own node_modules.
 *
 * Node.js module resolution walks up from the importer's location, so placing
 * the shim at node_modules/@boxyhq/saml-jackson/node_modules/jose makes it
 * visible to Jackson's dynamic import('jose') without replacing the real jose
 * that next-auth (or other packages) depend on at the top-level node_modules.
 */

const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const shimSrc = path.join(root, 'local_modules', 'jose')
const dest = path.join(root, 'node_modules', '@boxyhq', 'saml-jackson', 'node_modules', 'jose')

try {
  if (!fs.existsSync(path.join(root, 'node_modules', '@boxyhq', 'saml-jackson'))) {
    console.log('install-jose-shim: @boxyhq/saml-jackson not found, skipping')
    process.exit(0)
  }
  fs.mkdirSync(dest, { recursive: true })
  for (const file of ['index.js', 'package.json']) {
    fs.copyFileSync(path.join(shimSrc, file), path.join(dest, file))
  }
  console.log('install-jose-shim: jose shim installed at', dest)
} catch (err) {
  // Non-fatal — let the build continue; if jose is available from elsewhere it will work.
  console.warn('install-jose-shim: warning —', err.message)
}
