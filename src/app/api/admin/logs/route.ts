import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin'
import { stat, readFile } from 'fs/promises'
import { existsSync, createReadStream } from 'fs'
import { join, basename } from 'path'
import os from 'os'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface LogFileInfo {
  name: string
  path: string
  size: number
  mtime: Date
}

function getCandidateLogFiles(): { name: string; path: string }[] {
  const root = process.cwd()
  const home = os.homedir()
  return [
    { name: 'dev.log', path: join(root, 'dev.log') },
    { name: 'logs.txt', path: join(root, 'logs.txt') },
    { name: 'sf9_installer.log', path: join(home, 'sf9_installer.log') },
    { name: 'installer_local.log', path: join(root, 'sf9_installer.log') },
  ]
}

export async function GET(req: NextRequest) {
  const { errorResponse } = await requireAdmin(req)
  if (errorResponse) return errorResponse

  const selectedFile = req.nextUrl.searchParams.get('file')

  const candidates = getCandidateLogFiles()

  if (selectedFile) {
    // Return selected file download
    const safeName = basename(selectedFile)
    const matched = candidates.find((c) => c.name === safeName)
    if (!matched || !existsSync(matched.path)) {
      return NextResponse.json({ ok: false, error: 'Log file not found' }, { status: 404 })
    }

    try {
      const fileBuffer = await readFile(matched.path)
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="${safeName}"`,
        },
      })
    } catch {
      return NextResponse.json({ ok: false, error: 'Failed to read log file' }, { status: 500 })
    }
  }

  // List available log files
  const available: LogFileInfo[] = []
  for (const item of candidates) {
    if (existsSync(item.path)) {
      try {
        const fileStat = await stat(item.path)
        available.push({
          name: item.name,
          path: item.path,
          size: fileStat.size,
          mtime: fileStat.mtime,
        })
      } catch {
        // ignore
      }
    }
  }

  return NextResponse.json({
    ok: true,
    logs: available,
  })
}
