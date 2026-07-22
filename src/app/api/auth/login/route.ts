import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, signToken, signPartialToken } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const { isLimited, resetSeconds } = checkRateLimit('login', req, 10, 60 * 1000)
  if (isLimited) {
    return NextResponse.json(
      { ok: false, error: `Too many login attempts. Please try again in ${resetSeconds} seconds.` },
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
    return NextResponse.json({ ok: false, error: 'Username and password required' }, { status: 400 })
  }

  const user = await db.user.findUnique({ where: { username: username.toLowerCase() } })
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Invalid credentials' }, { status: 401 })
  }

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    return NextResponse.json({ ok: false, error: 'Invalid credentials' }, { status: 401 })
  }

  const isAdmin = Boolean(user.isAdmin)

  // If 2FA is enabled, return a partial token — client must verify TOTP code
  if (user.totpEnabled) {
    const partialToken = await signPartialToken({ userId: user.id, username: user.username, isAdmin })
    return NextResponse.json({
      ok: true,
      requires2FA: true,
      partialToken,
      user: { id: user.id, username: user.username, isAdmin },
    })
  }

  // No 2FA — issue full session token
  const token = await signToken({ userId: user.id, username: user.username, isAdmin })

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
    user: { id: user.id, username: user.username, totpEnabled: false, isAdmin },
  })
}