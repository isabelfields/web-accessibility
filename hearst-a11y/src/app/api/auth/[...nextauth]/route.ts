import NextAuth from 'next-auth'
import { authOptions } from '@/auth'

// Force dynamic so cookies/headers are always evaluated at request time (Next.js 15).
export const dynamic = 'force-dynamic'

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
