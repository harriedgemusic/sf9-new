/**
 * GET /api/spotify/file?name=<filename>
 *
 * Streams a single downloaded MP3 file to the client. Path traversal is
 * blocked by stripping the input through basename().
 */

import { NextRequest, NextResponse } from 'next/server'
import { getJobs } from '@/lib/jobs'
import { getUserFromRequest } from '@/lib/auth/request'
import { basename } from 'path'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const jobs = getJobs(user.userId)

  const name = req.nextUrl.searchParams.get('name')
  if (!name) {
    return NextResponse.json({ ok: false, error: 'Missing ?name=' }, { status: 400 })
  }

  const safe = basename(name)
  try {
    const data = await jobs.readFile(safe)
    if (!data) {
      return NextResponse.json({ ok: false, error: 'File not found' }, { status: 404 })
    }

    const mime = safe.toLowerCase().endsWith('.wav') ? 'audio/wav' : 'audio/mpeg'

    return new NextResponse(data as any, {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(safe)}"`,
        'Content-Length': data.length.toString(),
        'Cache-Control': 'no-store',
      },
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
