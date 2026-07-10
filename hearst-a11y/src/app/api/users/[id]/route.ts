import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sql } from '@/lib/db'
import { requireAdmin } from '@/lib/auth-helpers'

type Ctx = { params: Promise<{ id: string }> }

const PatchSchema = z.object({
  role: z.enum(['admin', 'user']).optional(),
  allowedDivisions: z.array(z.string()).optional(),
})

export async function PATCH(req: NextRequest, { params }: Ctx) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  const parsed = PatchSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { role, allowedDivisions } = parsed.data

  // If setting role to user, divisions must be explicitly provided and non-empty.
  if (role === 'user' && allowedDivisions !== undefined && allowedDivisions.length === 0) {
    return NextResponse.json({ error: 'Users must be assigned at least one division.' }, { status: 400 })
  }
  // If downgrading an existing admin to user without supplying divisions, check current state.
  if (role === 'user' && allowedDivisions === undefined) {
    const [existing] = await sql`SELECT allowed_divisions FROM users WHERE id = ${id} LIMIT 1`
    if (!existing || (existing.allowed_divisions as string[]).length === 0) {
      return NextResponse.json({ error: 'Assign at least one division before changing role to user.' }, { status: 400 })
    }
  }

  const [user] = await sql`
    UPDATE users
    SET role = COALESCE(${role ?? null}, role),
        allowed_divisions = COALESCE(${allowedDivisions != null ? JSON.stringify(allowedDivisions) : null}::jsonb, allowed_divisions)
    WHERE id = ${id}
    RETURNING id, email, role, allowed_divisions
  `
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(user)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  // Prevent deleting yourself
  if (id === admin.id) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
  }
  await sql`DELETE FROM users WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
