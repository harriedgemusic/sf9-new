/**
 * POST /api/spotify/clear-history
 *
 * Wipes the entire download history:
 *   - Deletes all MP3 files in the output directory
 *   - Deletes all ZIP / tar.gz archives
 *   - Clears the in-memory log buffer
 *   - Resets the download summary (downloaded/skipped/failed/total = 0)
 *   - Resets the cookies-required flag
 *
 * Optional body: { deleteCookies?: boolean }
 *   - If true, also deletes the YouTube cookies.txt file. Default: false
 *     (cookies are preserved so the user doesn't have to re-enter them
 *     after clearing the download history).
 *
 * All connected SSE clients receive 'logs-cleared', 'summary',
 * 'history-cleared', 'cookies-updated' and 'cookies-required' events.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getJobs } from '@/lib/jobs'
import { getUserFromRequest } from '@/lib/auth/request'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const jobs = getJobs(user.userId)

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    // body is optional
  }

  const deleteCookies = body?.deleteCookies === true

  try {
    const result = await jobs.clearHistory({ deleteCookiesToo: deleteCookies })
    return NextResponse.json({
      ok: true,
      deletedFiles: result.deletedFiles,
      deletedArchives: result.deletedArchives,
      cookiesDeleted: deleteCookies,
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
