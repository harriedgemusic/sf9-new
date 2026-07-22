import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, isValidPassword, isValidUsername, signToken } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const { isLimited, resetSeconds } = checkRateLimit('register', req, 5, 60 * 1000)
  if (isLimited) {
    return NextResponse.json(
      { ok: false, error: `Too many registration attempts. Please try again in ${resetSeconds} seconds.` },
      { status: 429 }
    )
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { username, password } = body || {}

  if (!username || !password) {
    return NextResponse.json({ ok: false, error: 'Username and password are required' }, { status: 400 })
  }
  if (!isValidUsername(username)) {
    return NextResponse.json({ ok: false, error: 'Username must be 2–32 characters (a-z, 0-9, ., _, -)' }, { status: 400 })
  }
  if (!isValidPassword(password)) {
    return NextResponse.json({ ok: false, error: 'Password must be 6–128 characters' }, { status: 400 })
  }

  const lowerUsername = username.toLowerCase()
  if (lowerUsername === 'admin') {
    return NextResponse.json({ ok: false, error: 'Username admin is reserved' }, { status: 400 })
  }

  const existing = await db.user.findUnique({ where: { username: lowerUsername } })
  if (existing) {
    return NextResponse.json({ ok: false, error: 'Username already taken' }, { status: 409 })
  }

  const passwordHash = await hashPassword(password)
  const user = await db.user.create({
    data: {
      username: username.toLowerCase(),
      passwordHash,
    },
  })

  const token = await signToken({ userId: user.id, username: user.username })

  await db.session.create({
    data: {
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  })

  return NextResponse.json({
    ok: true,
    token,
    user: { id: user.id, username: user.username, totpEnabled: false },
  })
}