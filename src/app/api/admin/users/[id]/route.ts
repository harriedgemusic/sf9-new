import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth/admin'
import { hashPassword, isValidPassword } from '@/lib/auth'
import { rm } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { errorResponse } = await requireAdmin(req)
  if (errorResponse) return errorResponse

  const { id } = await params
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { newPassword } = body || {}
  if (!newPassword || !isValidPassword(newPassword)) {
    return NextResponse.json(
      { ok: false, error: 'New password must be between 6 and 128 characters' },
      { status: 400 }
    )
  }

  const targetUser = await db.user.findUnique({ where: { id } })
  if (!targetUser) {
    return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 })
  }

  const passwordHash = await hashPassword(newPassword)
  await db.user.update({
    where: { id },
    data: { passwordHash },
  })

  // Invalidate all active sessions for this user so they must re-login
  await db.session.deleteMany({ where: { userId: id } })

  return NextResponse.json({ ok: true, message: 'Password updated successfully' })
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { errorResponse, user: adminUser } = await requireAdmin(req)
  if (errorResponse) return errorResponse

  const { id } = await params

  if (adminUser?.id === id) {
    return NextResponse.json({ ok: false, error: 'Cannot delete your own admin account' }, { status: 400 })
  }

  const targetUser = await db.user.findUnique({ where: { id } })
  if (!targetUser) {
    return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 })
  }

  // Delete user from DB (cascades sessions & downloadLogs)
  await db.user.delete({ where: { id } })

  // Clean up user download directory if it exists
  const userDir = join(process.cwd(), 'download', 'users', id)
  if (existsSync(userDir)) {
    try {
      await rm(userDir, { recursive: true, force: true })
    } catch {
      // Ignore directory removal error
    }
  }

  return NextResponse.json({ ok: true, message: 'User deleted successfully' })
}
