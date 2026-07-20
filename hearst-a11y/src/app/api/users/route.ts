import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sql } from '@/lib/db'
import { requireAdmin } from '@/lib/auth-helpers'
import { sha256 } from '@/lib/security'
import crypto from 'crypto'

const InviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'user']),
  allowedDivisions: z.array(z.string()).optional(),
  sso: z.boolean().optional(),
})

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const users = await sql`
    SELECT id, email, role, allowed_divisions, invited_by, created_at,
           invite_token IS NOT NULL AND invite_expires_at > NOW() as pending
    FROM users
    ORDER BY created_at ASC
  `
  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = InviteSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { email, role, allowedDivisions, sso } = parsed.data

  const existing = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`
  if (existing.length > 0) {
    return NextResponse.json({ error: 'User already exists' }, { status: 409 })
  }

  const divisions = allowedDivisions ?? []

  // SSO users authenticate via Okta and are JIT-provisioned on first sign-in.
  // They don't need (and shouldn't receive) a password-based invite link.
  // Also fall back to SSO_DOMAIN env var for automatic detection.
  const ssoDomain = process.env.SSO_DOMAIN?.trim().toLowerCase()
  const emailDomain = email.split('@')[1]?.toLowerCase()
  const isSsoUser = sso === true || (ssoDomain ? emailDomain === ssoDomain : false)

  if (isSsoUser) {
    const [user] = await sql`
      INSERT INTO users (email, role, allowed_divisions, invited_by)
      VALUES (${email}, ${role}, ${JSON.stringify(divisions)}, ${admin.email ?? ''})
      RETURNING id, email, role, allowed_divisions, created_at
    `
    return NextResponse.json({ ...user, sso: true }, { status: 201 })
  }

  // Store only a hash of the token; the plaintext is returned once for the link.
  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  const [user] = await sql`
    INSERT INTO users (email, role, allowed_divisions, invite_token, invite_expires_at, invited_by)
    VALUES (${email}, ${role}, ${JSON.stringify(divisions)}, ${sha256(token)}, ${expiresAt.toISOString()}, ${admin.email ?? ''})
    RETURNING id, email, role, allowed_divisions, created_at
  `

  return NextResponse.json({ ...user, inviteToken: token, invite_token: token }, { status: 201 })
}
