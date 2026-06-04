import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { sql } from '@/lib/db'

type Ctx = { params: Promise<{ token: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { token } = await params
  const [user] = await sql`
    SELECT id, email, role FROM users
    WHERE invite_token = ${token} AND invite_expires_at > NOW()
    LIMIT 1
  `
  if (!user) return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 404 })
  return NextResponse.json({ email: user.email, role: user.role })
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { token } = await params
  const { password } = await req.json()
  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const [user] = await sql`
    SELECT id FROM users
    WHERE invite_token = ${token} AND invite_expires_at > NOW()
    LIMIT 1
  `
  if (!user) return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 404 })

  const hash = await bcrypt.hash(password, 10)
  await sql`
    UPDATE users
    SET password_hash = ${hash}, invite_token = NULL, invite_expires_at = NULL
    WHERE id = ${user.id}
  `
  return NextResponse.json({ ok: true })
}
