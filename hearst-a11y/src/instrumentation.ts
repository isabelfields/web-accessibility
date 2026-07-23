export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (!process.env.DATABASE_URL) return

  try {
    const { neon } = await import('@neondatabase/serverless')
    const { MIGRATION_SQL } = await import('@/lib/db/schema')
    const sql = neon(process.env.DATABASE_URL)

    for (const statement of splitSql(MIGRATION_SQL)) {
      await sql(statement)
    }

    console.log('[migrate] Schema up to date')
  } catch (err) {
    console.error('[migrate] Migration failed on startup:', err)
  }
}

// Splits a SQL string on `;` while respecting single-quotes and $$-dollar-quotes.
function splitSql(sqlText: string): string[] {
  const statements: string[] = []
  let current = ''
  let inSingleQuote = false
  let inDollarQuote = false

  for (let i = 0; i < sqlText.length; i++) {
    const char = sqlText[i]
    const nextTwo = sqlText.slice(i, i + 2)

    if (!inSingleQuote && nextTwo === '$$') {
      inDollarQuote = !inDollarQuote
      current += nextTwo
      i++
      continue
    }

    if (!inDollarQuote && char === "'") {
      inSingleQuote = !inSingleQuote
    }

    if (char === ';' && !inSingleQuote && !inDollarQuote) {
      const statement = current.trim()
      if (statement) statements.push(statement)
      current = ''
      continue
    }

    current += char
  }

  const tail = current.trim()
  if (tail) statements.push(tail)
  return statements
}
