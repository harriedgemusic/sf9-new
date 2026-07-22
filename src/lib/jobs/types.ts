/**
 * Default process execution timeout in milliseconds (3 minutes).
 */
export const DEFAULT_PROCESS_TIMEOUT_MS = 180000

/**
 * Maximum number of log entries retained in memory buffer per user session.
 */
export const MAX_LOG_BUFFER_SIZE = 500

export interface Track {

  title: string
  artist: string
  duration_ms: number
  cover_url: string | null
  spotify_url: string | null
  track_id: string | null
  album?: string
  label?: string
  release_date?: string
}

export type LogLevel = 'info' | 'warning' | 'error'

export interface LogEntry {
  level: LogLevel
  message: string
  ts: string
  extra?: Record<string, unknown>
}

export interface JobSummary {
  downloaded: number
  skipped: number
  failed: number
  total: number
}

export interface DownloadResult {
  ok: boolean
  status?: 'downloaded' | 'skipped' | 'failed' | 'needs_pick'
  file?: string | null
  message?: string
  error?: string
  candidates?: TrackCandidate[]
  track?: Track
}

export interface TrackCandidate {
  url: string
  title: string
  duration: number // seconds
  platform: 'YouTube' | 'SoundCloud'
  matches_filter: boolean
  similar: boolean
}

export interface FetchResult {
  ok: boolean
  entity_type?: 'playlist' | 'album' | 'track'
  entity_id?: string
  tracks?: Track[]
  error?: string
}

export interface DownloadedFile {
  name: string
  size: number
  mtime: number
}

export interface ZipArchive {
  name: string
  size: number
  mtime: number
  trackCount: number
}
