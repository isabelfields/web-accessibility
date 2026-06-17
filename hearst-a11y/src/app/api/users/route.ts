import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sql } from '@/lib/db'
import { requireAdmin } from '@/lib/auth-helpers'
import crypto from 'crypto'

const InviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'user']),
  allowedDivisions: z.array(z.string()).optional(),
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
  const { email, role, allowedDivisions } = parsed.data

  const existing = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`
  if (existing.length > 0) {
    return NextResponse.json({ error: 'User already exists' }, { status: 409 })
  }

  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  const divisions = allowedDivisions ?? []

  const [user] = await sql`
    INSERT INTO users (email, role, allowed_divisions, invite_token, invite_expires_at, invited_by)
    VALUES (${email}, ${role}, ${JSON.stringify(divisions)}, ${token}, ${expiresAt.toISOString()}, ${admin.email ?? ''})
    RETURNING id, email, role, allowed_divisions, invite_token, created_at
  `

  return NextResponse.json({ ...user, inviteToken: token }, { status: 201 })
}
