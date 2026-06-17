import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { MIGRATION_SQL } from '@/lib/db/schema'
import { isValidBearer } from '@/lib/security'

export const dynamic = 'force-dynamic'

/**
 * Applies the database schema (MIGRATION_SQL) automatically instead of
 * requiring a manual copy-paste into the Neon SQL editor.
 *
 * Guarded by CRON_SECRET so it can be run during/after a deploy with:
 *   curl -X POST https://<app>/api/migrate \
 *     -H "Authorization: Bearer $CRON_SECRET"
 *
 * Every statement is idempotent (IF NOT EXISTS), so it is safe to re-run.
 */
export async function POST(req: NextRequest) {
  if (!isValidBearer(req.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_URL is not set' }, { status: 500 })
  }

  const sql = neon(process.env.DATABASE_URL)

  // The Neon HTTP driver runs one statement per call, so split on `;`.
  // Statements are individually idempotent, so partial reruns are safe.
  const statements = MIGRATION_SQL
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  const applied: string[] = []
  for (const statement of statements) {
    try {
      // Call the Neon query function directly with a plain SQL string
      // (ordinary-function usage). This version exposes no `.query()` method.
      await sql(statement)
      applied.push(statement.split('\n')[0].slice(0, 80))
    } catch (e: any) {
      return NextResponse.json(
        {
          error: 'Migration failed',
          statement: statement.split('\n')[0].slice(0, 200),
          message: e?.message,
          appliedSoFar: applied,
        },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ ok: true, statementsApplied: applied.length, applied })
}
