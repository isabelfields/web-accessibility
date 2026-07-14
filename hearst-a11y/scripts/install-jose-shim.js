'use strict'

/**
 * Patches @boxyhq/saml-jackson/dist/controller/utils.js before next build.
 *
 * Jackson uses `new Function('return import(pkg)')()` to load jose — a pattern
 * that intentionally bypasses webpack so no alias or plugin can intercept it.
 * Node.js resolves it natively, but the Lambda's node_modules layer is cached
 * and doesn't include jose, so every deploy fails at runtime.
 *
 * This script replaces that one line in utils.js with a static require('jose')
 * for the jose case. webpack can resolve static require strings via alias, so
 * when next build runs with @boxyhq/saml-jackson bundled (not external), webpack
 * inlines our local jose shim directly into .next/ — no node_modules needed at
 * runtime on Lambda.
 */

const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const utilsPath = path.join(root, 'node_modules', '@boxyhq', 'saml-jackson', 'dist', 'controller', 'utils.js')

if (!fs.existsSync(utilsPath)) {
  console.log('patch-jackson: utils.js not found, skipping')
  process.exit(0)
}

let src = fs.readFileSync(utilsPath, 'utf8')

// The line we need to replace (compiled TS, single line):
// const dynamicImport = (packageName) => __awaiter(..., function* () { return new Function(`return import('${packageName}')`)(); });
//
// Replace the new Function trick with a static require for jose so webpack
// can bundle it. For any other package, keep the original dynamic behaviour.
const ORIGINAL = "new Function(`return import('${packageName}')`)();"
const PATCHED  = "packageName === 'jose' ? require('jose') : new Function(`return import('${packageName}')`)();"

if (src.includes(PATCHED)) {
  console.log('patch-jackson: already patched, skipping')
  process.exit(0)
}

if (!src.includes(ORIGINAL)) {
  console.warn('patch-jackson: target string not found — jackson version may have changed')
  process.exit(0)
}

src = src.replace(ORIGINAL, PATCHED)
fs.writeFileSync(utilsPath, src, 'utf8')
console.log('patch-jackson: patched utils.js — jose now resolves via static require')
