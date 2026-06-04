import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { sql } from '@/lib/db'
import crypto from 'crypto'

export async function GET() {
  const session = await auth()
  if (session?.user?.role !== 'admin') {
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
  const session = await auth()
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { email, role, allowedDivisions } = await req.json()
  if (!email || !role) {
    return NextResponse.json({ error: 'email and role required' }, { status: 400 })
  }

  const existing = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`
  if (existing.length > 0) {
    return NextResponse.json({ error: 'User already exists' }, { status: 409 })
  }

  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  const divisions = allowedDivisions ?? []

  const [user] = await sql`
    INSERT INTO users (email, role, allowed_divisions, invite_token, invite_expires_at, invited_by)
    VALUES (${email}, ${role}, ${JSON.stringify(divisions)}, ${token}, ${expiresAt.toISOString()}, ${session.user.email})
    RETURNING id, email, role, allowed_divisions, invite_token, created_at
  `

  return NextResponse.json({ ...user, inviteToken: token }, { status: 201 })
}
