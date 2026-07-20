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
  // Exclude static assets (public folder files with extensions), Next.js internals, and public routes.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png|.*\\.jpg|.*\\.ico|.*\\.webp|.*\\.woff2?|api/auth|api/cron|api/migrate|api/invite|login|invite).*)'],
  // Note: api/auth covers /api/auth/saml/status so the diagnostic is publicly accessible.
}
