/**
 * POST /api/spotify/cookies
 *
 * Saves a YouTube cookies.txt file (Netscape format) to disk. Subsequent
 * yt-dlp invocations will automatically pick it up via the --cookies flag
 * (the env var YTDLP_COOKIES_FILE is read by the python helper).
 *
 * Body: { content: string }
 *   - Must start with "# Netscape HTTP Cookie File"
 *
 * Use this when YouTube returns the "Sign in to confirm you're not a bot"
 * error. The user can export cookies from their browser using a browser
 * extension like "Get cookies.txt LOCALLY" (Chrome) or "cookies.txt"
 * (Firefox), then paste the contents into the textarea in the UI.
 *
 * GET  /api/spotify/cookies — returns { available: boolean }
 * DELETE /api/spotify/cookies — removes the cookies file
 */

import { NextRequest, NextResponse } from 'next/server'
import { getJobs } from '@/lib/jobs'
import { getUserFromRequest } from '@/lib/auth/request'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const jobs = getJobs(user.userId)
  return NextResponse.json({ ok: true, available: jobs.hasCookies() })
}

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

  const content = typeof body?.content === 'string' ? body.content : ''
  if (!content.trim()) {
    return NextResponse.json({ ok: false, error: 'Missing content' }, { status: 400 })
  }

  const result = await jobs.saveCookies(content)
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const jobs = getJobs(user.userId)
  await jobs.deleteCookies()
  return NextResponse.json({ ok: true })
}
