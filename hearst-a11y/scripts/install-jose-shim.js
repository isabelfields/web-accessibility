'use strict'

/**
 * Copies the jose shim into node_modules/jose so Jackson's runtime
 * import('jose') can find it.
 *
 * Jackson uses `new Function('return import(pkg)')()` which bypasses webpack —
 * Node.js resolves the import natively at runtime, so jose MUST exist as a
 * physical directory in node_modules. This script is invoked as a prebuild
 * step so the copy is present before `next build` packages the output and
 * the deployment ships it to Lambda.
 */

const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const shimSrc = path.join(root, 'local_modules', 'jose')

// Install at top-level node_modules/jose so Node.js finds it from any importer.
const destinations = [
  path.join(root, 'node_modules', 'jose'),
]

// Also install into jackson's own node_modules for belt-and-suspenders.
const jacksonDir = path.join(root, 'node_modules', '@boxyhq', 'saml-jackson')
if (fs.existsSync(jacksonDir)) {
  destinations.push(path.join(jacksonDir, 'node_modules', 'jose'))
}

for (const dest of destinations) {
  try {
    fs.mkdirSync(dest, { recursive: true })
    for (const file of ['index.js', 'package.json']) {
      fs.copyFileSync(path.join(shimSrc, file), path.join(dest, file))
    }
    console.log('install-jose-shim: installed at', dest)
  } catch (err) {
    console.warn('install-jose-shim: warning —', err.message)
  }
}
