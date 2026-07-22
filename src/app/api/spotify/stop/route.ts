/**
 * POST /api/spotify/stop
 *
 * Aborts all in-flight operations:
 *   - kills every running python child process (fetch / download / batch)
 *   - marks the current batch loop as aborted so it stops scheduling new
 *     tracks
 *   - emits a 'stopped' SSE event to all connected clients
 *
 * Already-downloaded files are kept on disk. The abort flag is
 * automatically reset when the next fetch or batch starts.
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

  try {
    jobs.stop()
    return NextResponse.json({ ok: true, message: 'Stop requested' })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
