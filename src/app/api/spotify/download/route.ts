/**
 * POST /api/spotify/download
 *
 * Body: {
 *   track: Track,
 *   audioFormat?: 'mp3-320' | 'wav-16-44100',
 *   searchMode?: 'extended' | 'simple',
 *   searchParams?: { maxDurationSeconds, shortTitleKeywords, similarityThreshold, extendedMixSuffixes, existingSuffixPattern }
 * }
 * Response: DownloadResult
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

  const track = body?.track as Track | undefined
  if (!track || typeof track.title !== 'string' || typeof track.artist !== 'string') {
    return NextResponse.json({ ok: false, error: 'Missing or invalid track' }, { status: 400 })
  }

  const audioFormat = body?.audioFormat === 'wav-16-44100' ? 'wav-16-44100' : 'mp3-320'
  const searchMode = body?.searchMode === 'simple' ? 'simple' : 'extended'
  const searchParams = body?.searchParams && typeof body.searchParams === 'object' ? body.searchParams : undefined

  try {
    const result = await jobs.download(track, audioFormat, searchMode, searchParams)
    return NextResponse.json(result, { status: result.ok || result.status === 'skipped' ? 200 : 500 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
