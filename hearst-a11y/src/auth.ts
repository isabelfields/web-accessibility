import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import type { NextAuthOptions } from 'next-auth'
import bcrypt from 'bcryptjs'
import { sql } from '@/lib/db'
import { safeEqual } from '@/lib/security'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase()
        const password = credentials?.password
        if (!email || !password) return null

        // Bootstrap admin from environment variables. Lets you sign in
        // before any invited users exist (and as a break-glass account).
        if (
          process.env.ADMIN_USERNAME &&
          email === process.env.ADMIN_USERNAME.trim().toLowerCase() &&
          safeEqual(password, process.env.ADMIN_PASSWORD)
        ) {
          return { id: '1', name: 'Admin', email, role: 'admin' as const, allowedDivisions: [] }
        }

        // Invited users: look up by email and verify their password hash.
        // Compare case-insensitively — invites are stored with the email as
        // the admin typed it, which may differ in case from what's typed here.
        const [user] = await sql`
          SELECT id, email, role, allowed_divisions, password_hash
          FROM users
          WHERE LOWER(email) = ${email}
          LIMIT 1
        `
        if (!user || !user.password_hash) return null

        const valid = await bcrypt.compare(password, user.password_hash)
        if (!valid) return null

        return {
          id: user.id,
          name: user.email,
          email: user.email,
          role: user.role as 'admin' | 'user',
          allowedDivisions: (user.allowed_divisions as string[]) ?? [],
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Initial sign-in: seed the token from the authorize() result.
        token.id = user.id
        token.role = user.role
        token.allowedDivisions = user.allowedDivisions
        token.refreshedAt = Date.now()
        return token
      }

      // Periodically re-read role/divisions from the DB so admin changes
      // (e.g. a demotion or division update) apply to live sessions without
      // requiring re-login. Skip the env bootstrap admin (id '1'), which has
      // no DB row (and isn't a valid UUID).
      const REFRESH_MS = 60_000
      if (token.id && token.id !== '1' && Date.now() - (token.refreshedAt ?? 0) > REFRESH_MS) {
        try {
          const [u] = await sql`
            SELECT role, allowed_divisions FROM users WHERE id = ${token.id} LIMIT 1
          `
          if (u) {
            token.role = u.role as 'admin' | 'user'
            token.allowedDivisions = (u.allowed_divisions as string[]) ?? []
          }
          token.refreshedAt = Date.now()
        } catch {
          // Keep the existing token on a transient DB error; retry next interval.
        }
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id
        session.user.role = token.role
        session.user.allowedDivisions = token.allowedDivisions
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'jwt' },
  secret: process.env.AUTH_SECRET,
}

export default NextAuth(authOptions)
