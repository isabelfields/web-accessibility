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
  const divisions = allowedDivisions ?? []

  const existing = await sql`SELECT id FROM users WHERE LOWER(email) = ${email.trim().toLowerCase()} LIMIT 1`
  if (existing.length > 0) {
    return NextResponse.json({ error: 'User already exists' }, { status: 409 })
  }

  if (role === 'user' && divisions.length === 0) {
    return NextResponse.json({ error: 'Users must be assigned at least one division.' }, { status: 400 })
  }

  if (sso) {
    // SSO users are pre-approved with no password — they log in via Okta.
    const [user] = await sql`
      INSERT INTO users (email, role, allowed_divisions, invited_by)
      VALUES (${email.trim().toLowerCase()}, ${role}, ${JSON.stringify(divisions)}, ${admin.email ?? ''})
      RETURNING id, email, role, allowed_divisions, created_at
    `
    return NextResponse.json(user, { status: 201 })
  }

  // Password users: generate a one-time invite link.
  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  const [user] = await sql`
    INSERT INTO users (email, role, allowed_divisions, invite_token, invite_expires_at, invited_by)
    VALUES (${email.trim().toLowerCase()}, ${role}, ${JSON.stringify(divisions)}, ${sha256(token)}, ${expiresAt.toISOString()}, ${admin.email ?? ''})
    RETURNING id, email, role, allowed_divisions, created_at
  `

  return NextResponse.json({ ...user, inviteToken: token, invite_token: token }, { status: 201 })
}
