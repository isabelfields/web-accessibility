import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { sql } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

const PatchSchema = z.object({
  role: z.enum(['admin', 'user']).optional(),
  allowedDivisions: z.array(z.string()).optional(),
})

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions)
  if ((session?.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  const parsed = PatchSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { role, allowedDivisions } = parsed.data
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
  const session = await getServerSession(authOptions)
  if ((session?.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  // Prevent deleting yourself
  if (id === (session?.user as any)?.id) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
  }
  await sql`DELETE FROM users WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
