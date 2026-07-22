/**
 * Shared types between frontend and the jobs-service.
 */

export type AudioFormat = 'mp3-320' | 'wav-16-44100'

/** Search mode:
 *  - 'extended' — Search Extended: tries Extended Mix / Original Mix for
 *    short tracks (< 4:30) or tracks with Mixed/Cut/Radio Edit keywords.
 *  - 'simple'   — Simple download: downloads the track exactly as it appears
 *    on Spotify, no extended-version search.
 */
export type SearchMode = 'extended' | 'simple'

/**
 * Tunable parameters for the extended-mix search algorithm. These map 1:1
 * to constants in the python helper (`scripts/spotify_dl.py`) and are
 * forwarded via the `SD_SEARCH_PARAMS` env var as JSON.
 */
export interface SearchParams {
  /** Tracks shorter than this (in seconds) are considered "short" and trigger
   *  the Extended Mix / Original Mix search. Default: 270 (4:30). */
  maxDurationSeconds: number
  /** Comma-separated regex keywords. If a track title matches, the extended
   *  search is triggered even if the track is longer than maxDurationSeconds.
   *  Default: "mixed|cut|radioedit|radio edit" */
  shortTitleKeywords: string
  /** Title similarity threshold (0..1). Search results whose title is less
   *  similar to "{artist} - {title} {suffix}" than this are rejected.
   *  Default: 0.70 */
  similarityThreshold: number
  /** Comma-separated list of suffixes tried in order when searching for a
   *  longer version. Default: "Extended Mix,Original Mix" (+ empty string
   *  is always appended as a final fallback). */
  extendedMixSuffixes: string
  /** Comma-separated regex of suffixes that, if already present in the
   *  Spotify title, skip the extended-mix search and just download the
   *  exact match. Default: "extended|original|club mix" */
  existingSuffixPattern: string
  /** Regex pattern for "(ArtistName Remix)" suffixes in Spotify titles.
   *  When present, the search for a longer version is always triggered.
   *  Default: "\\([^\\)]*\\bremix\\b[^\\)]*\\)" */
  remixSuffixPattern: string
}

export const DEFAULT_SEARCH_PARAMS: SearchParams = {
  maxDurationSeconds: 270,
  shortTitleKeywords: 'mixed|cut|radioedit|radio edit',
  similarityThreshold: 0.70,
  extendedMixSuffixes: 'Extended Mix,Original Mix',
  existingSuffixPattern: 'extended|original|club mix',
  remixSuffixPattern: '\\([^\\)]*\\bremix\\b[^\\)]*\\)',
}



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

export interface LogEntry {
  level: 'info' | 'warning' | 'error'
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

export interface TrackCandidate {
  url: string
  title: string
  duration: number  // seconds
  platform: 'YouTube' | 'SoundCloud'
  matches_filter: boolean
  similar: boolean
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

export interface FetchResult {
  ok: boolean
  entity_type?: 'playlist' | 'album' | 'track'
  entity_id?: string
  tracks?: Track[]
  error?: string
}

export interface DownloadProgress {
  track: Track
  result: DownloadResult
}
