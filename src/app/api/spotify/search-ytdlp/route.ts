/**
 * POST /api/spotify/search-ytdlp
 *
 * Body: { query: string }
 * Response: { ok: boolean, candidates: TrackCandidate[], error?: string }
 *
 * Searches yt-dlp directly for song title / keyword queries, returning up to
 * 10 matching candidate tracks with durations.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getJobs } from '@/lib/jobs'
import { getUserFromRequest } from '@/lib/auth/request'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

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

  const query = typeof body?.query === 'string' ? body.query.trim() : ''
  if (!query) {
    return NextResponse.json({ ok: false, error: 'Missing query' }, { status: 400 })
  }

  try {
    const result = await jobs.searchYtdlp(query)
    return NextResponse.json(result, { status: result.ok ? 200 : 500 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
