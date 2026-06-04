import NextAuth from 'next-auth'
import { authOptions } from '@/auth'
import type { NextRequest } from 'next/server'

// next-auth v4 App Router: call NextAuth(req, context, options) directly
async function handler(req: NextRequest, context: any) {
  return NextAuth(req, context, authOptions)
}

export { handler as GET, handler as POST }
