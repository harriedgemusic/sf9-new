/**
 * GET /api/spotify/files
 *
 * Returns the list of downloaded MP3 files AND archive files (zip/tar.gz)
 * in the shared output directory, plus whether YouTube cookies are
 * currently configured.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getJobs, getOutputDir } from '@/lib/jobs'
import { getUserFromRequest } from '@/lib/auth/request'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const jobs = getJobs(user.userId)

  try {
    const [files, archives] = await Promise.all([jobs.listFiles(), jobs.listArchives()])
    return NextResponse.json({
      ok: true,
      files,
      archives,
      cookiesAvailable: jobs.hasCookies(),
      outputDir: getOutputDir(user.userId),
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
