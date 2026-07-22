import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/request'
import { db } from '@/lib/db'

export async function requireAdmin(req: NextRequest) {
  const payload = await getUserFromRequest(req)
  if (!payload) {
    return { errorResponse: NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }), payload: null }
  }

  const user = await db.user.findUnique({ where: { id: payload.userId } })
  if (!user) {
    return { errorResponse: NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 }), payload: null }
  }

  const isAdmin = Boolean(user.isAdmin)
  if (!isAdmin) {
    return { errorResponse: NextResponse.json({ ok: false, error: 'Forbidden: Admin access required' }, { status: 403 }), payload: null }
  }

  return { errorResponse: null, user, payload }
}
