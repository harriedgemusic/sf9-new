import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyTotp, verifyPartialToken, signToken, verifyToken } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const { isLimited, resetSeconds } = checkRateLimit('2fa-verify', req, 6, 60 * 1000)
  if (isLimited) {
    return NextResponse.json(
      { ok: false, error: `Too many 2FA verification attempts. Please try again in ${resetSeconds} seconds.` },
      { status: 429 }
    )
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { token: authToken, code, partialToken, setup } = body || {}

  // Two modes:
  // 1. setup=true: verify TOTP code against the pending secret (enabling 2FA)
  // 2. setup=false (default): verify TOTP code during login with partialToken

  if (setup) {
    // Enabling 2FA — user has a full session token
    if (!authToken || !code) {
      return NextResponse.json({ ok: false, error: 'token and code required' }, { status: 400 })
    }

    const payload = await verifyToken(authToken)
    if (!payload) {
      return NextResponse.json({ ok: false, error: 'Invalid token' }, { status: 401 })
    }

    const user = await db.user.findUnique({ where: { id: payload.userId } })
    if (!user || !user.totpSecret) {
      return NextResponse.json({ ok: false, error: '2FA setup not started' }, { status: 400 })
    }

    const { ok } = verifyTotp(user.totpSecret, code)
    if (!ok) {
      return NextResponse.json({ ok: false, error: 'Invalid code' }, { status: 400 })
    }

    await db.user.update({
      where: { id: user.id },
      data: { totpEnabled: true },
    })

    return NextResponse.json({ ok: true })
  }

  // Login mode — verify TOTP against enabled user's secret
  if (!partialToken || !code) {
    return NextResponse.json({ ok: false, error: 'partialToken and code required' }, { status: 400 })
  }

  const partialPayload = await verifyPartialToken(partialToken)
  if (!partialPayload) {
    return NextResponse.json({ ok: false, error: 'Partial token expired' }, { status: 401 })
  }

  const user = await db.user.findUnique({ where: { id: partialPayload.userId } })
  if (!user || !user.totpSecret || !user.totpEnabled) {
    return NextResponse.json({ ok: false, error: 'Invalid state' }, { status: 400 })
  }

  const { ok } = verifyTotp(user.totpSecret, code)
  if (!ok) {
    return NextResponse.json({ ok: false, error: 'Invalid 2FA code' }, { status: 400 })
  }

  const fullToken = await signToken({ userId: user.id, username: user.username })

  await db.session.create({
    data: {
      userId: user.id,
      token: fullToken,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  })

  return NextResponse.json({
    ok: true,
    token: fullToken,
    user: { id: user.id, username: user.username, totpEnabled: true },
  })
}