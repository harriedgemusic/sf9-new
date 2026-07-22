/**
 * Shared utility functions used by the frontend.
 * Extracted from page.tsx for testability.
 */

import type { Track } from '@/lib/spotify-types'

export const MAX_DURATION_SECONDS = 4 * 60 + 30

/**
 * Format duration in milliseconds to "m:ss" string.
 */
export function formatDuration(ms: number): string {
  if (!ms) return '--:--'
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * Format file size in bytes to human-readable string.
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/**
 * Determine if a track needs an extended mix search:
 *  - Duration less than 4:30
 *  - Title contains mixed/cut/radioedit/radio edit keywords
 */
export function needsExtendedMix(track: Track): boolean {
  if (!track.duration_ms) return false
  return track.duration_ms / 1000 < MAX_DURATION_SECONDS ||
    /\b(mixed|cut|radioedit|radio\s*edit)\b/i.test(track.title)
}

/**
 * Generate a unique identifier string for a track.
 */
export function trackId(track: Track): string {
  return track.track_id || `${track.artist} - ${track.title}`
}

function normalizeStr(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]/gi, '')
}

/**
 * Find a downloaded file on disk matching the given track.
 */
export function findDownloadedFileForTrack(
  track: Track,
  files: { name: string }[],
  knownFilename?: string,
): { name: string } | undefined {
  if (!files || files.length === 0) return undefined

  if (knownFilename) {
    const matched = files.find((f) => f.name === knownFilename)
    if (matched) return matched
  }

  const normArtist = normalizeStr(track.artist)
  const normTitle = normalizeStr(track.title)

  if (!normArtist || !normTitle) return undefined

  return files.find((f) => {
    const nameWithoutExt = f.name.replace(/\.(mp3|wav)$/i, '')
    const normFile = normalizeStr(nameWithoutExt)
    return normFile.includes(normArtist) && normFile.includes(normTitle)
  })
}

