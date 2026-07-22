import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth/admin'
import { hashPassword, isValidPassword, isValidUsername } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { errorResponse } = await requireAdmin(req)
  if (errorResponse) return errorResponse

  const users = await db.user.findMany({
    select: {
      id: true,
      username: true,
      isAdmin: true,
      totpEnabled: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({
    ok: true,
    users: users.map((u) => ({
      ...u,
      isAdmin: Boolean(u.isAdmin),
    })),
  })
}

export async function POST(req: NextRequest) {
  const { errorResponse } = await requireAdmin(req)
  if (errorResponse) return errorResponse

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { username, password, isAdmin } = body || {}

  if (!username || !password) {
    return NextResponse.json({ ok: false, error: 'Username and password required' }, { status: 400 })
  }

  const cleanUsername = username.trim().toLowerCase()
  if (!isValidUsername(cleanUsername)) {
    return NextResponse.json(
      { ok: false, error: 'Username must be 2-32 characters (alphanumeric, dots, underscores, hyphens)' },
      { status: 400 }
    )
  }

  if (!isValidPassword(password)) {
    return NextResponse.json(
      { ok: false, error: 'Password must be between 6 and 128 characters' },
      { status: 400 }
    )
  }

  const existing = await db.user.findUnique({ where: { username: cleanUsername } })
  if (existing) {
    return NextResponse.json({ ok: false, error: 'Username already taken' }, { status: 409 })
  }

  const passwordHash = await hashPassword(password)
  const newUser = await db.user.create({
    data: {
      username: cleanUsername,
      passwordHash,
      isAdmin: Boolean(isAdmin),
    },
    select: {
      id: true,
      username: true,
      isAdmin: true,
      totpEnabled: true,
      createdAt: true,
    },
  })

  return NextResponse.json({
    ok: true,
    user: {
      ...newUser,
      isAdmin: Boolean(newUser.isAdmin),
    },
  })
}
