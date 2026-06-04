import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl
    const isAdminRoute = pathname.startsWith('/admin') || pathname.startsWith('/api/users')

    if (isAdminRoute) {
      const role = req.nextauth.token?.role
      if (role !== 'admin') {
        return NextResponse.redirect(new URL('/', req.nextUrl))
      }
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl
        // Allow invite pages and cron without auth
        if (pathname.startsWith('/invite/') || pathname.startsWith('/api/cron')) return true
        return !!token
      },
    },
    pages: { signIn: '/login' },
  }
)

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
}
