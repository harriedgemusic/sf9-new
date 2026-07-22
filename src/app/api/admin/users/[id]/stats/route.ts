import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth/admin'
import { readdir, stat, rm, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface RouteParams {
  params: Promise<{ id: string }>
}

async function getDirectorySize(dirPath: string): Promise<number> {
  if (!existsSync(dirPath)) return 0
  let totalSize = 0
  try {
    const entries = await readdir(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name)
      if (entry.isDirectory()) {
        totalSize += await getDirectorySize(fullPath)
      } else if (entry.isFile()) {
        const fileStat = await stat(fullPath)
        totalSize += fileStat.size
      }
    }
  } catch {
    // Ignore errors
  }
  return totalSize
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { errorResponse } = await requireAdmin(req)
  if (errorResponse) return errorResponse

  const { id } = await params
  const targetUser = await db.user.findUnique({ where: { id } })
  if (!targetUser) {
    return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 })
  }

  // Fetch download logs for user
  const downloadLogs = await db.downloadLog.findMany({
    where: { userId: id },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  // Group by searchMode
  const extendedCount = await db.downloadLog.count({
    where: { userId: id, searchMode: 'extended' },
  })
  const simpleCount = await db.downloadLog.count({
    where: { userId: id, searchMode: 'simple' },
  })
  const totalDownloaded = downloadLogs.length

  // Calculate storage size of user's download folder
  const userDownloadDir = join(process.cwd(), 'download', 'users', id)
  const storageSizeBytes = await getDirectorySize(userDownloadDir)

  return NextResponse.json({
    ok: true,
    user: {
      id: targetUser.id,
      username: targetUser.username,
    },
    stats: {
      totalDownloaded,
      extendedCount,
      simpleCount,
      storageSizeBytes,
    },
    logs: downloadLogs,
  })
}

/**
 * Clear/wipe user's download directory
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { errorResponse } = await requireAdmin(req)
  if (errorResponse) return errorResponse

  const { id } = await params
  const targetUser = await db.user.findUnique({ where: { id } })
  if (!targetUser) {
    return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 })
  }

  const userTracksDir = join(process.cwd(), 'download', 'users', id, 'tracks')
  let deletedFiles = 0

  if (existsSync(userTracksDir)) {
    try {
      const files = await readdir(userTracksDir)
      for (const file of files) {
        const fullPath = join(userTracksDir, file)
        try {
          await unlink(fullPath)
          deletedFiles++
        } catch {
          // ignore individual deletion errors
        }
      }
    } catch {
      // ignore readdir errors
    }
  }

  return NextResponse.json({
    ok: true,
    message: `User storage cleared (${deletedFiles} file(s) removed)`,
    deletedFiles,
  })
}
