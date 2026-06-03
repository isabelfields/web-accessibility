import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(req: NextRequest) {
  const isLoginPage = req.nextUrl.pathname === '/login'
  const isAuthApi = req.nextUrl.pathname.startsWith('/api/auth')
  const isCronApi = req.nextUrl.pathname.startsWith('/api/cron')

  if (isAuthApi || isCronApi) return NextResponse.next()

  const token = await getToken({ req, secret: process.env.AUTH_SECRET })
  const isLoggedIn = !!token

  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', req.nextUrl))
  }
  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL('/', req.nextUrl))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
