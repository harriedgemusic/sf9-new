import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken, verifyPassword, hashPassword, isValidPassword } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await verifyToken(token)
  if (!payload) {
    return NextResponse.json({ ok: false, error: 'Invalid or expired token' }, { status: 401 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { currentPassword, newPassword } = body || {}

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { ok: false, error: 'Current password and new password are required' },
      { status: 400 }
    )
  }

  if (!isValidPassword(newPassword)) {
    return NextResponse.json(
      { ok: false, error: 'New password must be between 6 and 128 characters' },
      { status: 400 }
    )
  }

  const user = await db.user.findUnique({ where: { id: payload.userId } })
  if (!user) {
    return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 })
  }

  const isCurrentValid = await verifyPassword(currentPassword, user.passwordHash)
  if (!isCurrentValid) {
    return NextResponse.json(
      { ok: false, error: 'Incorrect current password' },
      { status: 400 }
    )
  }

  const newHash = await hashPassword(newPassword)
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash },
  })

  return NextResponse.json({ ok: true })
}
