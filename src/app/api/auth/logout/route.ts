import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (token) {
    const payload = await verifyToken(token)
    if (payload) {
      await db.session.deleteMany({ where: { token } })
    }
  }

  return NextResponse.json({ ok: true })
}