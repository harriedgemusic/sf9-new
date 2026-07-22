/**
 * POST /api/spotify/download-all
 *
 * Body: {
 *   tracks: Track[],
 *   audioFormat?: 'mp3-320' | 'wav-16-44100',
 *   searchMode?: 'extended' | 'simple',
 *   searchParams?: { maxDurationSeconds, shortTitleKeywords, similarityThreshold, extendedMixSuffixes, existingSuffixPattern }
 * }
 * Response: { ok: boolean, count: number, audioFormat, searchMode }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getJobs, type Track } from '@/lib/jobs'
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

  const tracks = body?.tracks as Track[] | undefined
  if (!Array.isArray(tracks) || tracks.length === 0) {
    return NextResponse.json({ ok: false, error: 'Missing or empty tracks array' }, { status: 400 })
  }

  const audioFormat = body?.audioFormat === 'wav-16-44100' ? 'wav-16-44100' : 'mp3-320'
  const searchMode = body?.searchMode === 'simple' ? 'simple' : 'extended'
  const searchParams = body?.searchParams && typeof body.searchParams === 'object' ? body.searchParams : undefined

  // Kick off the batch in the background; do NOT await it.
  jobs.downloadAll(tracks, audioFormat, searchMode, searchParams).catch((e) => {
    console.error('Batch download failed:', e)
  })

  return NextResponse.json({
    ok: true,
    message: `Batch download started for ${tracks.length} tracks`,
    count: tracks.length,
    audioFormat,
    searchMode,
  })
}
