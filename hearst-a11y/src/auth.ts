import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import type { NextAuthOptions } from 'next-auth'
import bcrypt from 'bcryptjs'
import { sql } from '@/lib/db'
import { safeEqual } from '@/lib/security'
import { SAML_CLIENT_ID } from '@/lib/jackson'

const NEXTAUTH_URL = process.env.NEXTAUTH_URL!

export const authOptions: NextAuthOptions = {
  providers: [
    // ── SAML / Okta SSO via BoxyHQ Jackson ──────────────────────────────────
    {
      id: 'boxyhq-saml',
      name: 'SSO',
      type: 'oauth',
      authorization: {
        url: `${NEXTAUTH_URL}/api/auth/saml/authorize`,
        params: { provider: 'saml' },
      },
      token: `${NEXTAUTH_URL}/api/auth/saml/token`,
      userinfo: `${NEXTAUTH_URL}/api/auth/saml/userinfo`,
      // client_id tells Jackson which tenant/product to use.
      clientId: SAML_CLIENT_ID,
      // Must match clientSecretVerifier in lib/jackson.ts.
      clientSecret: process.env.JACKSON_CLIENT_SECRET || 'jackson-secret',
      profile(profile: any) {
        return {
          id: profile.id ?? profile.email,
          email: profile.email,
          name: [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.email,
          role: 'user' as const,
          allowedDivisions: [] as string[],
        }
      },
      allowDangerousEmailAccountLinking: true,
    } as any,

    // ── Email / password (existing) ──────────────────────────────────────────
    CredentialsProvider({
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase()
        const password = credentials?.password
        if (!email || !password) return null

        if (
          process.env.ADMIN_USERNAME &&
          email === process.env.ADMIN_USERNAME.trim().toLowerCase() &&
          safeEqual(password, process.env.ADMIN_PASSWORD)
        ) {
          return { id: '1', name: 'Admin', email, role: 'admin' as const, allowedDivisions: [] }
        }

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
    // JIT provisioning + token seeding.
    async jwt({ token, user, account }) {
      if (user) {
        if (account?.provider === 'boxyhq-saml') {
          // SAML sign-in: look up (or create) the user in our DB.
          const email = user.email?.trim().toLowerCase()
          console.log('[auth/jwt] SSO sign-in, raw email from profile:', user.email, '→ normalized:', email)
          if (!email) return token

          // If this email matches the bootstrap admin, grant admin role on JIT provision.
          const isBootstrapAdmin =
            !!process.env.ADMIN_USERNAME &&
            email === process.env.ADMIN_USERNAME.trim().toLowerCase()

          await sql`
            INSERT INTO users (email, role, allowed_divisions)
            VALUES (${email}, ${isBootstrapAdmin ? 'admin' : 'user'}, '[]'::jsonb)
            ON CONFLICT (email) DO UPDATE
              SET role = 'admin'
              WHERE users.email = EXCLUDED.email AND ${isBootstrapAdmin}
          `
          const [dbUser] = await sql`
            SELECT id, role, allowed_divisions FROM users WHERE LOWER(email) = ${email} LIMIT 1
          `
          console.log('[auth/jwt] DB lookup result:', dbUser ? { id: dbUser.id, role: dbUser.role } : 'NOT FOUND')
          if (dbUser) {
            token.id = dbUser.id
            token.role = dbUser.role as 'admin' | 'user'
            token.allowedDivisions = (dbUser.allowed_divisions as string[]) ?? []
          }
        } else {
          // Credentials sign-in: values come from authorize().
          token.id = user.id
          token.role = (user as any).role
          token.allowedDivisions = (user as any).allowedDivisions
        }
        token.refreshedAt = Date.now()
        return token
      }

      // Periodically refresh role/divisions for non-bootstrap users.
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
          // Keep existing token on transient DB error; retry next interval.
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
