/**
 * POST /api/spotify/download-url
 *
 * Body: { url: string, artist: string, title: string, audioFormat?: 'mp3-320' | 'wav-16-44100' }
 * Response: DownloadResult
 *
 * Downloads a specific URL directly (used when the user manually picks a
 * candidate from the picker dialog). Bypasses the search algorithm.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getJobs } from '@/lib/jobs'
import { getUserFromRequest } from '@/lib/auth/request'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 600

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

  const url = typeof body?.url === 'string' ? body.url.trim() : ''
  const artist = typeof body?.artist === 'string' ? body.artist : ''
  const title = typeof body?.title === 'string' ? body.title : ''

  if (!url || !title) {
    return NextResponse.json({ ok: false, error: 'Missing url or title' }, { status: 400 })
  }

  const audioFormat = body?.audioFormat === 'wav-16-44100' ? 'wav-16-44100' : 'mp3-320'

  try {
    const result = await jobs.downloadUrl(url, artist, title, audioFormat)
    return NextResponse.json(result, { status: result.ok ? 200 : 500 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
