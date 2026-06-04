import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const { pathname } = req.nextUrl
  const isLoginPage = pathname === '/login'
  const isAuthApi = pathname.startsWith('/api/auth')
  const isCronApi = pathname.startsWith('/api/cron')
  const isInvitePage = pathname.startsWith('/invite/')
  const isAdminRoute = pathname.startsWith('/admin') || pathname.startsWith('/api/users')

  if (isAuthApi || isCronApi || isInvitePage) return NextResponse.next()
  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', req.nextUrl))
  }
  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL('/', req.nextUrl))
  }
  if (isLoggedIn && isAdminRoute) {
    const role = (req.auth as any)?.user?.role
    if (role !== 'admin') {
      return NextResponse.redirect(new URL('/', req.nextUrl))
    }
  }
  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
