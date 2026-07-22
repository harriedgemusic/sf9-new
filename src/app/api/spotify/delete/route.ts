/**
 * DELETE /api/spotify/delete?name=<filename>
 * GET /api/spotify/delete?name=<filename>  (fallback for clients that can't send DELETE)
 *
 * Deletes a single downloaded MP3 file from the shared output directory.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getJobs } from '@/lib/jobs'
import { getUserFromRequest } from '@/lib/auth/request'
import { basename } from 'path'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function handle(name: string | null, userId: string) {
  if (!name) {
    return NextResponse.json({ ok: false, error: 'Missing ?name=' }, { status: 400 })
  }
  const safe = basename(name)
  const jobs = getJobs(userId)
  const ok = await jobs.deleteFile(safe)
  if (!ok) {
    return NextResponse.json({ ok: false, error: 'File not found or could not be deleted' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  return handle(req.nextUrl.searchParams.get('name'), user.userId)
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  return handle(req.nextUrl.searchParams.get('name'), user.userId)
}
