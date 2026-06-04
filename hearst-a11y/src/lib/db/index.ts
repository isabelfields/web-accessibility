import { neon, type NeonQueryFunction } from '@neondatabase/serverless'

// Lazy singleton — neon() is called on first query, not at module load time.
// This prevents build failures when DATABASE_URL is not set during `next build`.
let _client: NeonQueryFunction<false, false> | undefined

function getClient(): NeonQueryFunction<false, false> {
  if (!_client) _client = neon(process.env.DATABASE_URL!)
  return _client
}

// Cast to any then back to the proper type so TypeScript accepts the wrapper
// while callers still get correct return types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sql = ((strings: TemplateStringsArray, ...values: any[]) =>
  getClient()(strings, ...values)) as unknown as NeonQueryFunction<false, false>
