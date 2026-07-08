import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: '/login',
    },
  }
)

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth|api/cron|api/migrate|api/invite|login|invite).*)'],
  // /api/auth/saml/callback is already excluded via api/auth above.
}
