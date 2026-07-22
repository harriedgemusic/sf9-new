/**
 * GET /api/spotify/archive?name=<filename>
 *
 * Streams a single ZIP / tar.gz archive to the client. Path traversal is
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
  const archive = await jobs.getArchiveStream(safe)
  if (archive) {
    const encodedName = encodeURIComponent(safe)
    const asciiName = safe.replace(/["\r\n]/g, '_')
    return new NextResponse(archive.stream as any, {
      status: 200,
      headers: {
        'Content-Type': archive.mime,
        'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
        'Content-Length': archive.size.toString(),
        'Cache-Control': 'no-store',
      },
    })
  }

  const result = await jobs.readArchive(safe)
  if (!result) {
    return NextResponse.json({ ok: false, error: 'Archive not found' }, { status: 404 })
  }

  const encodedName = encodeURIComponent(safe)
  const asciiName = safe.replace(/["\r\n]/g, '_')
  return new NextResponse(result.data as any, {
    status: 200,
    headers: {
      'Content-Type': result.mime,
      'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
      'Content-Length': result.data.length.toString(),
      'Cache-Control': 'no-store',
    },
  })
}
