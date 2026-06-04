import type { NextAuthOptions } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'

async function findOrBootstrapUser(email: string, password: string) {
  const { sql } = await import('@/lib/db')
  const bcrypt = await import('bcryptjs')

  const [{ count }] = await sql`SELECT COUNT(*)::int as count FROM users`

  if (count === 0) {
    const adminEmail = process.env.ADMIN_USERNAME ?? 'admin'
    const adminPassword = process.env.ADMIN_PASSWORD
    if (adminPassword && email === adminEmail) {
      const hash = await bcrypt.hash(adminPassword, 10)
      const [newUser] = await sql`
        INSERT INTO users (email, password_hash, role, allowed_divisions)
        VALUES (${adminEmail}, ${hash}, 'admin', '[]')
        RETURNING id, email, role, allowed_divisions
      `
      return newUser
    }
    return null
  }

  const [user] = await sql`SELECT * FROM users WHERE email = ${email} LIMIT 1`
  if (!user || !user.password_hash) return null
  const valid = await bcrypt.compare(password, user.password_hash)
  return valid ? user : null
}

export const authOptions: NextAuthOptions = {
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const user = await findOrBootstrapUser(
          credentials.email as string,
          credentials.password as string,
        )
        if (!user) return null
        return {
          id: user.id,
          email: user.email,
          name: user.email,
          role: user.role as 'admin' | 'user',
          allowedDivisions: (user.allowed_divisions as string[]) ?? [],
        }
      },
    }),
  ],
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string
        token.role = (user as any).role
        token.allowedDivisions = (user as any).allowedDivisions
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).allowedDivisions = token.allowedDivisions
      }
      return session
    },
  },
}
