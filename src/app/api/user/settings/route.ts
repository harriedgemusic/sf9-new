import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
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

  let settings: Record<string, unknown> = {}
  try {
    settings = JSON.parse(user.settings)
  } catch {
    settings = {}
  }

  return NextResponse.json({ ok: true, settings })
}

export async function PUT(req: NextRequest) {
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

  const { settings } = body || {}
  if (!settings || typeof settings !== 'object') {
    return NextResponse.json({ ok: false, error: 'settings object required' }, { status: 400 })
  }

  await db.user.update({
    where: { id: payload.userId },
    data: { settings: JSON.stringify(settings) },
  })

  return NextResponse.json({ ok: true })
}