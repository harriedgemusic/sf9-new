/**
 * POST /api/spotify/fetch
 *
 * Body: { url: string }
 * Response: FetchResult (with tracks[] array)
 *
 * Calls the python helper to fetch metadata for a Spotify playlist or
 * single track. The python script streams JSON log lines back; those are
 * forwarded to all connected SSE clients via the jobs manager emitter.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getJobs } from '@/lib/jobs'
import { getUserFromRequest } from '@/lib/auth/request'
import { validateInput } from '@/lib/resilience'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const jobs = getJobs(user.userId)

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const rawUrl = typeof body?.url === 'string' ? body.url.trim() : ''
  if (!rawUrl) {
    return NextResponse.json({ ok: false, error: 'Missing url' }, { status: 400 })
  }

  let url: string
  try {
    url = validateInput(rawUrl, 'url', { maxLength: 2048, allowedSchemes: ['http', 'https'] })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 400 })
  }

  try {
    const result = await jobs.fetch(url)
    return NextResponse.json(result, { status: result.ok ? 200 : 500 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
