/**
 * File system manager helper for Jobs service
 */

import { existsSync, createReadStream, createWriteStream } from 'fs'
import { mkdir, readdir, stat, unlink, readFile, writeFile } from 'fs/promises'
import { join, basename } from 'path'
import { createGzip } from 'zlib'
import type { DownloadedFile, ZipArchive } from './types'

const PROJECT_ROOT = /*turbopackIgnore: true*/ process.cwd()

export function getOutputDir(userId: string): string {
  return join(PROJECT_ROOT, 'download', 'users', userId, 'tracks')
}

export function getCookiesFile(userId: string): string {
  return join(PROJECT_ROOT, 'download', 'users', userId, 'youtube-cookies.txt')
}

export async function listDownloadedFiles(outputDir: string): Promise<DownloadedFile[]> {
  if (!existsSync(outputDir)) return []
  try {
    const names = await readdir(outputDir)
    const files: DownloadedFile[] = []
    for (const name of names) {
      if (name.endsWith('.mp3') || name.endsWith('.wav')) {
        const filePath = join(outputDir, name)
        const s = await stat(filePath)
        files.push({
          name,
          size: s.size,
          mtime: Math.floor(s.mtimeMs),
        })
      }
    }
    return files.sort((a, b) => b.mtime - a.mtime)
  } catch {
    return []
  }
}

export async function listZipArchives(userDir: string): Promise<ZipArchive[]> {
  const zipsDir = join(userDir, 'zips')
  if (!existsSync(zipsDir)) return []
  try {
    const names = await readdir(zipsDir)
    const zips: ZipArchive[] = []
    for (const name of names) {
      if (name.endsWith('.zip') || name.endsWith('.tar.gz')) {
        const filePath = join(zipsDir, name)
        const s = await stat(filePath)
        zips.push({
          name,
          size: s.size,
          mtime: Math.floor(s.mtimeMs),
          trackCount: 0, // dynamically populating if metadata available
        })
      }
    }
    return zips.sort((a, b) => b.mtime - a.mtime)
  } catch {
    return []
  }
}

export async function removeFile(filePath: string): Promise<boolean> {
  if (!existsSync(filePath)) return false
  try {
    await unlink(filePath)
    return true
  } catch {
    return false
  }
}
