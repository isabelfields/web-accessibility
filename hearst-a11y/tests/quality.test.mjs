import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('package exposes quality scripts', async () => {
  const pkg = JSON.parse(await read('package.json'))
  assert.equal(pkg.scripts.typecheck, 'tsc --noEmit')
  assert.ok(pkg.scripts.lint)
  assert.ok(pkg.scripts.build)
  assert.equal(pkg.scripts.test, 'npm run typecheck && node --test tests/*.test.mjs')
})

test('migration contains database-level data integrity constraints', async () => {
  const schema = await read('src/lib/db/schema.ts')
  for (const constraint of [
    'scan_jobs_status_check',
    'scan_jobs_site_fk',
    'scan_jobs_schedule_fk',
    'schedules_cadence_check',
    'schedules_site_fk',
    'users_role_check',
    'violation_triage_status_check',
    'violation_triage_site_fk',
  ]) {
    assert.match(schema, new RegExp(constraint))
  }
})

test('scanner guards navigation URLs before and after Playwright navigation', async () => {
  const scanner = await read('src/lib/scanner/index.ts')
  assert.match(scanner, /page\.route\('\*\*\/\*'/)
  assert.match(scanner, /request\.isNavigationRequest\(\)/)
  assert.match(scanner, /await assertPublicUrl\(pw\.url\(\)\)/)
})

test('dashboard uses a ranked scan query instead of per-site latest scan queries', async () => {
  const dashboard = await read('src/app/page.tsx')
  assert.match(dashboard, /WITH ranked_scans AS/)
  assert.doesNotMatch(dashboard, /sites\.map\(async \(site\)/)
})
