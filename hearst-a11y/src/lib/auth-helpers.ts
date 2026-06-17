import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'

export interface SessionUser {
  id?: string
  email?: string | null
  role?: 'admin' | 'user'
  allowedDivisions?: string[]
}

/**
 * Returns the authenticated user from the session, or null if unauthenticated.
 * Routes are already behind the auth middleware, but calling this gives each
 * handler its own defense-in-depth check and access to role/divisions.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  return session.user as SessionUser
}

/** Returns the user if they're an admin, otherwise null (caller returns 403). */
export async function requireAdmin(): Promise<SessionUser | null> {
  const user = await getSessionUser()
  return user?.role === 'admin' ? user : null
}

/**
 * Mirrors the visibility rule used by `GET /api/sites`: admins — and users with
 * no division restriction — can see everything; otherwise access is limited to
 * sites whose division is in the user's allowedDivisions. Keeping this identical
 * to the list query ensures a single-site endpoint can't be used to read or
 * mutate sites the user would never see in the list.
 */
export function canAccessDivision(user: SessionUser, division: string | null | undefined): boolean {
  if (user.role === 'admin') return true
  const allowed = user.allowedDivisions ?? []
  if (allowed.length === 0) return true
  return division != null && allowed.includes(division)
}
