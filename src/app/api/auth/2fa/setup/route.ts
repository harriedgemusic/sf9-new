import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateSecret, getTotpUri } from '@/lib/auth'
import { verifyToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await verifyToken(token)
  if (!payload) {
    return NextResponse.json({ ok: false, error: 'Invalid or expired token' }, { status: 401 })
  }

  const user = await db.user.findUnique({ where: { id: payload.userId } })
  if (!user) {
    return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 })
  }

  if (user.totpEnabled) {
    return NextResponse.json({ ok: false, error: '2FA is already enabled' }, { status: 400 })
  }

  const secret = generateSecret()
  const uri = getTotpUri(secret, user.username)

  await db.user.update({
    where: { id: user.id },
    data: { totpSecret: secret },
  })

  return NextResponse.json({ ok: true, secret, uri })
}

export async function DELETE(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await verifyToken(token)
  if (!payload) {
    return NextResponse.json({ ok: false, error: 'Invalid or expired token' }, { status: 401 })
  }

  await db.user.update({
    where: { id: payload.userId },
    data: { totpSecret: null, totpEnabled: false },
  })

  return NextResponse.json({ ok: true })
}