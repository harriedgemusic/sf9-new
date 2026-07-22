/**
 * Server-side singleton for orchestrating Spotify fetch / download jobs.
 *
 * This module is imported by Next.js API routes. It maintains:
 *  - An in-memory log buffer (capped at 500 entries)
 *  - An EventEmitter that fans out every new log / progress / summary event
 *    to all connected SSE clients
 *  - A registry of running jobs (so we can prevent duplicate downloads)
 *
 * The actual heavy lifting (Spotify API, yt-dlp search, MP3 download) is
 * performed by the python helper at /scripts/spotify_dl.py. We spawn it as
 * a child process and parse its JSON-line stdout.
 *
 * IMPORTANT: this module must only be imported from server-side code
 * (API routes / server actions). It uses Node.js APIs that are not
 * available in the browser.
 */

import { spawn, spawnSync } from 'child_process'
import { EventEmitter } from 'events'
import { existsSync, createReadStream, createWriteStream } from 'fs'
import { mkdir, readdir, stat, unlink, readFile, writeFile } from 'fs/promises'
import { join, basename } from 'path'
import { createGzip } from 'zlib'
import { Readable } from 'stream'
import { db } from '@/lib/db'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  duration: number  // seconds
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

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PROJECT_ROOT = /*turbopackIgnore: true*/ process.cwd()

export function getOutputDir(userId: string): string {
  return join(PROJECT_ROOT, 'download', 'users', userId, 'tracks')
}

export function getCookiesFile(userId: string): string {
  return join(PROJECT_ROOT, 'download', 'users', userId, 'youtube-cookies.txt')
}

// Pick the python binary once
function pickPython(): string {
  for (const candidate of ['python3', 'python']) {
    try {
      const r = spawnSync(candidate, ['--version'], { stdio: 'pipe' })
      if (r.status === 0) return candidate
    } catch {
      // try next
    }
  }
  return 'python3'
}

const PYTHON_BIN = pickPython()

// ---------------------------------------------------------------------------
// Server state
// ---------------------------------------------------------------------------

/**
 * Pattern that matches YouTube's "Sign in to confirm you're not a bot"
 * error from yt-dlp, indicating that cookies are required.
 */
const YT_COOKIES_ERROR_PATTERNS = [
  /Sign in to confirm you'?re not a bot/i,
  /cookies[-_]from[-_]browser/i,
  /Use --cookies[-_]from[-_]browser/i,
  /Sign in to confirm/i,
]

/**
 * Check whether a download error message indicates that YouTube requires
 * cookies. Returns a normalized reason string if yes, null otherwise.
 */
export function detectYouTubeCookiesError(errorMessage: string): boolean {
  if (!errorMessage) return false
  return YT_COOKIES_ERROR_PATTERNS.some((p) => p.test(errorMessage))
}

class JobsManager {
  readonly userId: string
  private outputDir: string
  private cookiesFile: string
  private logBuffer: LogEntry[] = []
  private readonly LOG_BUFFER_MAX = 500
  readonly emitter = new EventEmitter()
  private summary: JobSummary = { downloaded: 0, skipped: 0, failed: 0, total: 0 }
  private activeJobs = 0
  private cookiesRequested = false
  private lastBatchZip: { name: string; path: string; trackCount: number } | null = null
  /**
   * Map of running python child processes keyed by a job id. Used by stop()
   * to kill in-flight fetch / download / batch operations.
   */
  private runningChildren = new Map<string, ReturnType<typeof spawn>>()
  private aborted = false

  constructor(userId: string) {
    this.userId = userId
    this.outputDir = getOutputDir(userId)
    this.cookiesFile = getCookiesFile(userId)
    void mkdir(this.outputDir, { recursive: true })
    this.emitter.setMaxListeners(100)
  }

  private async recordDownload(
    trackTitle: string,
    trackArtist: string,
    searchMode: 'extended' | 'simple',
    format?: string,
    status?: string
  ) {
    try {
      await db.downloadLog.create({
        data: {
          userId: this.userId,
          trackTitle,
          trackArtist,
          searchMode,
          format: format || 'mp3-320',
          status: status || 'downloaded',
        },
      })
    } catch (e) {
      console.error('Failed to log download:', e)
    }
  }

  hasActiveJobs(): boolean {
    return this.activeJobs > 0 || this.runningChildren.size > 0
  }

  private incrementActiveJobs(): void {
    this.activeJobs++
    this.emit('active-status', { isDownloading: this.hasActiveJobs(), activeCount: this.activeJobs })
  }

  private decrementActiveJobs(): void {
    this.activeJobs = Math.max(0, this.activeJobs - 1)
    this.emit('active-status', { isDownloading: this.hasActiveJobs(), activeCount: this.activeJobs })
  }

  /**
   * Abort all in-flight operations: kills every running python child
   * process and marks the current batch (if any) as aborted so the loop
   * in downloadAll() stops scheduling new tracks. Already-downloaded files
   * are kept on disk.
   */
  stop(): void {
    this.aborted = true
    this.activeJobs = 0
    this.pushLog({
      level: 'warning',
      message: 'Stop requested — aborting in-flight operations',
      ts: new Date().toISOString().slice(11, 19),
    })
    for (const [id, child] of this.runningChildren.entries()) {
      try {
        child.kill('SIGTERM')
        // Give it 500ms, then force-kill
        setTimeout(() => {
          try { child.kill('SIGKILL') } catch { /* already dead */ }
        }, 500)
      } catch { /* ignore */ }
      this.runningChildren.delete(id)
    }
    this.emit('active-status', { isDownloading: false, activeCount: 0 })
    this.emit('stopped', { at: Date.now() })
  }


  private isAborted(): boolean {
    return this.aborted
  }

  /** Reset the abort flag — called when a new fetch / batch starts. */
  private resetAbort(): void {
    this.aborted = false
  }

  /**
   * Whether the server currently has a YouTube cookies.txt file configured.
   */
  hasCookies(): boolean {
    return existsSync(this.cookiesFile)
  }

  /**
   * Persist a Netscape-format cookies.txt file to disk. The next yt-dlp
   * invocation will automatically pick it up via the --cookies flag.
   */
  async saveCookies(content: string): Promise<{ ok: boolean; error?: string }> {
    let trimmed = content.trim()
    if (!trimmed) {
      return { ok: false, error: 'Cookies content is empty' }
    }
    if (!trimmed.includes('# Netscape HTTP Cookie File') && !trimmed.includes('# HTTP Cookie File')) {
      trimmed = `# Netscape HTTP Cookie File\n# Generated by sf9\n\n` + trimmed
    }
    try {
      await mkdir(join(PROJECT_ROOT, 'download'), { recursive: true })
      await writeFile(this.cookiesFile, trimmed, 'utf8')
      this.cookiesRequested = false
      this.emit('cookies-updated', { available: true })
      this.pushLog({
        level: 'info',
        message: 'YouTube cookies.txt updated — subsequent downloads will use it',
        ts: new Date().toISOString().slice(11, 19),
      })
      return { ok: true }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  }

  async deleteCookies(): Promise<void> {
      if (existsSync(this.cookiesFile)) {
      try { await unlink(this.cookiesFile) } catch { /* ignore */ }
      this.emit('cookies-updated', { available: false })
    }
  }

  getCookiesRequested(): boolean {
    return this.cookiesRequested
  }

  private setCookiesRequested(value: boolean): void {
    this.cookiesRequested = value
    this.emit('cookies-required', { required: value })
  }

  getLogs(): LogEntry[] {
    return this.logBuffer.slice()
  }

  getSummary(): JobSummary {
    return { ...this.summary }
  }

  resetSummary(): void {
    this.summary = { downloaded: 0, skipped: 0, failed: 0, total: 0 }
    this.emit('summary', this.summary)
  }

  clearLogs(): void {
    this.logBuffer.length = 0
    this.emit('logs-cleared', {})
  }

  private emit(event: string, payload: unknown): void {
    this.emitter.emit(event, payload)
  }

  private pushLog(entry: LogEntry): void {
    this.logBuffer.push(entry)
    if (this.logBuffer.length > this.LOG_BUFFER_MAX) {
      this.logBuffer.splice(0, this.logBuffer.length - this.LOG_BUFFER_MAX)
    }
    this.emit('log', entry)
  }

  private updateSummary(patch: Partial<JobSummary>): void {
    this.summary = { ...this.summary, ...patch }
    this.emit('summary', this.summary)
  }

  /**
   * Spawn the python helper with the given args. Each stdout line is parsed
   * as JSON; lines that match the log entry shape are pushed to the log
   * buffer, and the LAST non-log JSON object on stdout is returned as the
   * final payload.
   */
  private runPython(scriptName: string, args: string[], envExtra: Record<string, string> = {}): Promise<{ ok: boolean; payload: any; code: number }> {
    return new Promise((resolvePromise) => {
      // Pass cookies file env var so python script can append --cookies
      // to yt-dlp if the file exists. Also pass SD_AUDIO_FORMAT so the
      // python script knows which codec / container to use.
      const cookiesExist = existsSync(this.cookiesFile)
      const env = {
        ...process.env,
        PATH: `${process.env.PATH}:/home/z/.local/bin`,
        YTDLP_COOKIES_FILE: cookiesExist ? this.cookiesFile : '',
        ...envExtra,
      }
      const scriptPath = join(PROJECT_ROOT, 'scripts', scriptName)
      const child = spawn(PYTHON_BIN, [scriptPath, ...args], {
        env,
        cwd: PROJECT_ROOT,
      })

      // Register this child so stop() can kill it.
      const childId = `child-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      this.runningChildren.set(childId, child)

      let stdoutBuf = ''
      let stderrBuf = ''
      const finalPayloads: any[] = []

      const handleLine = (line: string) => {
        const trimmed = line.trim()
        if (!trimmed) return
        try {
          const obj = JSON.parse(trimmed)
          if (obj && typeof obj === 'object' && 'level' in obj && 'message' in obj) {
            this.pushLog(obj as LogEntry)
            return
          }
          finalPayloads.push(obj)
        } catch {
          this.pushLog({
            level: 'info',
            message: trimmed,
            ts: new Date().toISOString().slice(11, 19),
          })
        }
      }

      child.stdout.on('data', (chunk: Buffer) => {
        stdoutBuf += chunk.toString('utf8')
        let nl
        while ((nl = stdoutBuf.indexOf('\n')) !== -1) {
          const line = stdoutBuf.slice(0, nl)
          stdoutBuf = stdoutBuf.slice(nl + 1)
          handleLine(line)
        }
      })

      child.stderr.on('data', (chunk: Buffer) => {
        stderrBuf += chunk.toString('utf8')
        let nl
        while ((nl = stderrBuf.indexOf('\n')) !== -1) {
          const line = stderrBuf.slice(0, nl)
          stderrBuf = stderrBuf.slice(nl + 1)
          if (line.trim()) {
            this.pushLog({
              level: 'error',
              message: `[python stderr] ${line.trim()}`,
              ts: new Date().toISOString().slice(11, 19),
            })
          }
        }
      })

      child.on('close', (code: number | null) => {
        this.runningChildren.delete(childId)
        if (stdoutBuf.trim()) handleLine(stdoutBuf)
        const finalPayload = finalPayloads[finalPayloads.length - 1]
        resolvePromise({
          ok: (code ?? 0) === 0,
          payload: finalPayload ?? { ok: false, error: 'No payload from python' },
          code: code ?? 0,
        })
      })

      child.on('error', (err: Error) => {
        this.runningChildren.delete(childId)
        this.pushLog({
          level: 'error',
          message: `Failed to spawn python: ${err.message}`,
          ts: new Date().toISOString().slice(11, 19),
        })
        resolvePromise({ ok: false, payload: { ok: false, error: err.message }, code: -1 })
      })
    })
  }

  async fetch(url: string): Promise<FetchResult> {
    this.resetAbort()
    this.pushLog({
      level: 'info',
      message: `Starting fetch: ${url}`,
      ts: new Date().toISOString().slice(11, 19),
    })
    const { payload, ok } = await this.runPython('spotify_dl.py', ['fetch', url])
    if (this.isAborted()) {
      this.pushLog({
        level: 'warning',
        message: 'Fetch aborted by user',
        ts: new Date().toISOString().slice(11, 19),
      })
      return { ok: false, error: 'aborted' }
    }
    if (ok && payload?.ok) {
      this.pushLog({
        level: 'info',
        message: `Found ${payload.tracks?.length ?? 0} tracks`,
        ts: new Date().toISOString().slice(11, 19),
      })
    } else {
      this.pushLog({
        level: 'error',
        message: `Fetch failed: ${payload?.error ?? 'unknown'}`,
        ts: new Date().toISOString().slice(11, 19),
      })
    }
    return payload as FetchResult
  }

  async download(
    track: Track,
    audioFormat: 'mp3-320' | 'wav-16-44100' = 'mp3-320',
    searchMode: 'extended' | 'simple' = 'extended',
    searchParams?: Record<string, unknown>,
  ): Promise<DownloadResult> {
    this.incrementActiveJobs()
    this.updateSummary({ total: this.summary.total + 1 })

    const trackJson = JSON.stringify(track)
    const envExtra: Record<string, string> = {
      SD_AUDIO_FORMAT: audioFormat,
      SD_SEARCH_MODE: searchMode,
    }
    if (searchParams) {
      envExtra.SD_SEARCH_PARAMS = JSON.stringify(searchParams)
    }
    const scriptName = searchMode === 'simple' ? 'simple_dl.py' : 'spotify_dl.py'
    const { payload, ok } = await this.runPython(
      scriptName,
      ['download', trackJson, this.outputDir],
      envExtra,
    )

    let result: DownloadResult
    if (this.isAborted()) {
      this.updateSummary({ skipped: this.summary.skipped + 1 })
      result = { ok: false, status: 'skipped', message: 'aborted' }
    } else if (ok && payload?.status === 'downloaded') {
      this.updateSummary({ downloaded: this.summary.downloaded + 1 })
      result = payload as DownloadResult
    } else if (payload?.status === 'needs_pick') {
      // Extended search found candidates but none passed the duration
      // filter. Don't count as skipped/failed — the user will pick one.
      // Roll back the total counter so summary isn't skewed.
      this.updateSummary({ total: this.summary.total - 1 })
      result = payload as DownloadResult
    } else if (payload?.status === 'skipped') {
      this.updateSummary({ skipped: this.summary.skipped + 1 })
      result = payload as DownloadResult
    } else {
      this.updateSummary({ failed: this.summary.failed + 1 })
      result = (payload as DownloadResult) ?? { ok: false, status: 'failed', error: 'unknown' }
      const errMsg = payload?.error || payload?.message || ''
      if (detectYouTubeCookiesError(String(errMsg))) {
        this.setCookiesRequested(true)
      }
    }

    void this.recordDownload(track.title, track.artist, searchMode, audioFormat, result.status)
    this.emit('download-done', { track, result })
    this.decrementActiveJobs()
    return result
  }

  /**
   * Search yt-dlp directly for song title / keyword queries.
   */
  async searchYtdlp(query: string): Promise<{ ok: boolean; candidates: TrackCandidate[]; error?: string }> {
    const { payload, ok } = await this.runPython('spotify_dl.py', ['search_ytdlp', query])
    if (ok && payload?.ok) {
      return { ok: true, candidates: payload.candidates || [] }
    }
    return { ok: false, candidates: [], error: payload?.error || 'yt-dlp search failed' }
  }

  /**
   * Download a specific URL directly (used when the user manually picks a
   * candidate from the picker dialog). Bypasses the search algorithm.
   */
  async downloadUrl(
    url: string,
    artist: string,
    title: string,
    audioFormat: 'mp3-320' | 'wav-16-44100' = 'mp3-320',
  ): Promise<DownloadResult> {
    this.incrementActiveJobs()
    this.updateSummary({ total: this.summary.total + 1 })

    const envExtra: Record<string, string> = {
      SD_AUDIO_FORMAT: audioFormat,
    }
    const { payload, ok } = await this.runPython(
      'spotify_dl.py',
      ['download-url', url, artist, title, this.outputDir],
      envExtra,
    )

    let result: DownloadResult
    if (ok && payload?.status === 'downloaded') {
      this.updateSummary({ downloaded: this.summary.downloaded + 1 })
      result = payload as DownloadResult
    } else {
      this.updateSummary({ failed: this.summary.failed + 1 })
      result = (payload as DownloadResult) ?? { ok: false, status: 'failed', error: 'unknown' }
      const errMsg = payload?.error || payload?.message || ''
      if (detectYouTubeCookiesError(String(errMsg))) {
        this.setCookiesRequested(true)
      }
    }

    // Synthesize a track-like object for the download-done event so the
    // UI updates the right row (matched by artist + title).
    const track: Track = {
      title,
      artist,
      duration_ms: 0,
      cover_url: null,
      spotify_url: null,
      track_id: null,
    }
    void this.recordDownload(title, artist, 'simple', audioFormat, result.status)
    this.emit('download-done', { track, result })
    this.decrementActiveJobs()
    return result
  }

  async downloadAll(
    tracks: Track[],
    audioFormat: 'mp3-320' | 'wav-16-44100' = 'mp3-320',
    searchMode: 'extended' | 'simple' = 'extended',
    searchParams?: Record<string, unknown>,
  ): Promise<{ results: { track: Track; result: DownloadResult }[] }> {
    this.resetAbort()
    this.pushLog({
      level: 'info',
      message: `Starting batch download of ${tracks.length} tracks (format: ${audioFormat}, mode: ${searchMode})`,
      ts: new Date().toISOString().slice(11, 19),
    })

    this.updateSummary({ total: this.summary.total + tracks.length })

    const envExtra: Record<string, string> = {
      SD_AUDIO_FORMAT: audioFormat,
      SD_SEARCH_MODE: searchMode,
    }
    if (searchParams) {
      envExtra.SD_SEARCH_PARAMS = JSON.stringify(searchParams)
    }

    const results: { track: Track; result: DownloadResult }[] = []
    for (let i = 0; i < tracks.length; i++) {
      // Check abort flag before scheduling each track
      if (this.isAborted()) {
        this.pushLog({
          level: 'warning',
          message: `Batch aborted by user — skipped ${tracks.length - i} remaining track(s)`,
          ts: new Date().toISOString().slice(11, 19),
        })
        // Adjust the total counter so summary reflects only processed tracks
        this.updateSummary({ total: this.summary.total - (tracks.length - i) })
        break
      }

      const track = tracks[i]
      this.pushLog({
        level: 'info',
        message: `[${i + 1}/${tracks.length}] ${track.artist} - ${track.title}`,
        ts: new Date().toISOString().slice(11, 19),
      })

      const trackJson = JSON.stringify(track)
      const scriptName = searchMode === 'simple' ? 'simple_dl.py' : 'spotify_dl.py'
      const { payload, ok } = await this.runPython(
        scriptName,
        ['download', trackJson, this.outputDir],
        envExtra,
      )

      let result: DownloadResult
      if (this.isAborted()) {
        this.updateSummary({ skipped: this.summary.skipped + 1 })
        result = { ok: false, status: 'skipped', message: 'aborted' }
      } else if (ok && payload?.status === 'downloaded') {
        this.updateSummary({ downloaded: this.summary.downloaded + 1 })
        result = payload as DownloadResult
      } else if (payload?.status === 'needs_pick') {
        // Don't count needs_pick as skipped/failed
        this.updateSummary({ total: this.summary.total - 1 })
        result = payload as DownloadResult
      } else if (payload?.status === 'skipped') {
        this.updateSummary({ skipped: this.summary.skipped + 1 })
        result = payload as DownloadResult
      } else {
        this.updateSummary({ failed: this.summary.failed + 1 })
        result = (payload as DownloadResult) ?? { ok: false, status: 'failed', error: 'unknown' }
      }

      results.push({ track, result })
      void this.recordDownload(track.title, track.artist, searchMode, audioFormat, result.status)
      this.emit('download-done', { track, result })
    }

    this.pushLog({
      level: 'info',
      message: `Batch done. Downloaded: ${this.summary.downloaded}, skipped: ${this.summary.skipped}, failed: ${this.summary.failed}`,
      ts: new Date().toISOString().slice(11, 19),
    })

    // If at least one track was downloaded, create a ZIP archive of all
    // downloaded MP3 files for the user to grab in one click.
    if (this.summary.downloaded > 0) {
      try {
        const zip = await this.createZipArchive()
        if (zip) {
          this.pushLog({
            level: 'info',
            message: `ZIP archive created: ${zip.name} (${zip.trackCount} tracks)`,
            ts: new Date().toISOString().slice(11, 19),
          })
          this.emit('zip-created', zip)
        }
      } catch (e: any) {
        this.pushLog({
          level: 'error',
          message: `Failed to create ZIP: ${e.message}`,
          ts: new Date().toISOString().slice(11, 19),
        })
      }
    }

    this.emit('batch-done', { results, zip: this.lastBatchZip })
    return { results }
  }

  /**
   * Build a ZIP archive of all currently-downloaded MP3 files using the
   * system `zip` binary (which is widely available on Linux). Returns the
   * archive metadata, or null if the binary is missing / no files exist.
   */
  async createZipArchive(): Promise<ZipArchive | null> {
    const files = await this.listFiles()
    if (files.length === 0) return null

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const zipName = `spotify-tracks-${stamp}.zip`
    const zipPath = join(this.outputDir, zipName)

    // Try `zip` binary first; fall back to tar/gzip if not available.
    const zipAvailable = await new Promise<boolean>((resolve) => {
      const c = spawnSync('which', ['zip'], { stdio: 'pipe' })
      resolve(c.status === 0)
    })

    if (zipAvailable) {
      // Run: zip -j -q <zipPath> <each mp3 file>
      // -j: junk paths (store only basename)
      // -q: quiet
      const mp3Files = files.map((f) => join(this.outputDir, f.name))
      const result = spawnSync('zip', ['-j', '-q', zipPath, ...mp3Files], { stdio: 'pipe' })
      if (result.status !== 0) {
        throw new Error(`zip exited with ${result.status}: ${result.stderr?.toString().slice(0, 200)}`)
      }
    } else {
      // Fallback: use Node.js to create a .tar.gz archive (rename to .zip is
      // NOT correct, so we use the proper .tar.gz extension instead).
      // We still expose it as a downloadable archive.
      const tarballName = `spotify-tracks-${stamp}.tar.gz`
      const tarballPath = join(this.outputDir, tarballName)
      await this.createTarGz(tarballPath, files.map((f) => f.name))
      const s = await stat(tarballPath)
      this.lastBatchZip = { name: tarballName, path: tarballPath, trackCount: files.length }
      return { name: tarballName, size: s.size, mtime: s.mtimeMs, trackCount: files.length }
    }

    const s = await stat(zipPath)
    this.lastBatchZip = { name: zipName, path: zipPath, trackCount: files.length }
    return { name: zipName, size: s.size, mtime: s.mtimeMs, trackCount: files.length }
  }

  /**
   * Fallback tar.gz creator used when the `zip` binary is unavailable.
   * Uses tar(1) if available; otherwise builds a plain concatenated gzip
   * stream (not a real archive, but still downloadable).
   */
  private async createTarGz(tarballPath: string, fileNames: string[]): Promise<void> {
    const tarAvailable = await new Promise<boolean>((resolve) => {
      const c = spawnSync('which', ['tar'], { stdio: 'pipe' })
      resolve(c.status === 0)
    })
    if (tarAvailable) {
      const result = spawnSync(
        'tar',
        ['-czf', tarballPath, '-C', this.outputDir, ...fileNames],
        { stdio: 'pipe' }
      )
      if (result.status !== 0) {
        throw new Error(`tar exited with ${result.status}: ${result.stderr?.toString().slice(0, 200)}`)
      }
      return
    }
    // Last-resort: write a single concatenated gzip stream of all MP3 files.
    // This is technically valid gzip but only the first file will be
    // recoverable — emit a warning and create it anyway.
    this.pushLog({
      level: 'warning',
      message: 'Neither zip nor tar binary available; creating concatenated gzip fallback',
      ts: new Date().toISOString().slice(11, 19),
    })
    const out = createWriteStream(tarballPath)
    const gz = createGzip()
    gz.pipe(out)
    for (const name of fileNames) {
      const full = join(this.outputDir, name)
      if (!existsSync(full)) continue
      const rs = createReadStream(full)
      await new Promise<void>((resolve, reject) => {
        rs.pipe(gz, { end: false })
        rs.on('end', resolve)
        rs.on('error', reject)
      })
    }
    gz.end()
    await new Promise<void>((resolve) => out.on('finish', resolve))
  }

  /**
   * Read the most recently-created archive file (zip or tar.gz).
   */
  async readArchive(name: string): Promise<{ data: Buffer; mime: string } | null> {
    const safe = basename(name)
    const filePath = join(this.outputDir, safe)
    if (!filePath.startsWith(this.outputDir) || !existsSync(filePath)) return null
    const data = await readFile(filePath)
    const mime = safe.endsWith('.zip') ? 'application/zip'
      : safe.endsWith('.tar.gz') || safe.endsWith('.tgz') ? 'application/gzip'
      : 'application/octet-stream'
    return { data, mime }
  }

  /**
   * Stream the archive file using web ReadableStream to avoid loading large archives in memory.
   */
  async getArchiveStream(name: string): Promise<{ stream: ReadableStream; size: number; mime: string } | null> {
    const safe = basename(name)
    const filePath = join(this.outputDir, safe)
    if (!filePath.startsWith(this.outputDir) || !existsSync(filePath)) return null
    const s = await stat(filePath)
    const nodeStream = createReadStream(filePath)
    const mime = safe.endsWith('.zip') ? 'application/zip'
      : safe.endsWith('.tar.gz') || safe.endsWith('.tgz') ? 'application/gzip'
      : 'application/octet-stream'
    return { stream: Readable.toWeb(nodeStream) as unknown as ReadableStream, size: s.size, mime }
  }


  /**
   * Wipe the entire download history: deletes all MP3 + archive files in
   * the output directory, clears the in-memory log buffer, resets the
   * download summary, and notifies all connected clients. Optional cookies
   * file is preserved unless `deleteCookiesToo` is true.
   */
  async clearHistory(opts: { deleteCookiesToo?: boolean } = {}): Promise<{
    deletedFiles: number
    deletedArchives: number
  }> {
    let deletedFiles = 0
    let deletedArchives = 0

    if (existsSync(this.outputDir)) {
      const entries = await readdir(this.outputDir)
      for (const name of entries) {
        const full = join(this.outputDir, name)
        const lower = name.toLowerCase()
        try {
          if (lower.endsWith('.mp3') || lower.endsWith('.wav')) {
            await unlink(full)
            deletedFiles++
          } else if (lower.endsWith('.zip') || lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) {
            await unlink(full)
            deletedArchives++
          }
        } catch {
          // ignore individual file errors
        }
      }
    }

    if (opts.deleteCookiesToo) {
      await this.deleteCookies()
    }

    this.lastBatchZip = null
    this.logBuffer.length = 0
    this.summary = { downloaded: 0, skipped: 0, failed: 0, total: 0 }
    this.cookiesRequested = false

    // Notify all clients
    this.emit('logs-cleared', {})
    this.emit('summary', this.summary)
    this.emit('history-cleared', { deletedFiles, deletedArchives })
    this.emit('cookies-updated', { available: this.hasCookies() })
    this.emit('cookies-required', { required: false })

    return { deletedFiles, deletedArchives }
  }

  async listFiles(): Promise<DownloadedFile[]> {
    if (!existsSync(this.outputDir)) return []
    const entries = await readdir(this.outputDir)
    const result: DownloadedFile[] = []
    for (const name of entries) {
      const lower = name.toLowerCase()
      if (!lower.endsWith('.mp3') && !lower.endsWith('.wav')) continue
      const full = join(this.outputDir, name)
      try {
        const s = await stat(full)
        result.push({ name, size: s.size, mtime: s.mtimeMs })
      } catch {
        // ignore unreadable files
      }
    }
    result.sort((a, b) => b.mtime - a.mtime)
    return result
  }

  /**
   * Return metadata for the most recently-created archive (zip / tar.gz),
   * or null if none exists.
   */
  async listArchives(): Promise<ZipArchive[]> {
    if (!existsSync(this.outputDir)) return []
    const entries = await readdir(this.outputDir)
    const result: ZipArchive[] = []
    for (const name of entries) {
      const lower = name.toLowerCase()
      if (!lower.endsWith('.zip') && !lower.endsWith('.tar.gz') && !lower.endsWith('.tgz')) continue
      const full = join(this.outputDir, name)
      try {
        const s = await stat(full)
        // We can't easily read trackCount back from the archive; use the
        // number of MP3 files in the directory at the time of listing as a
        // rough approximation when not recorded.
        result.push({ name, size: s.size, mtime: s.mtimeMs, trackCount: 0 })
      } catch {
        // ignore
      }
    }
    result.sort((a, b) => b.mtime - a.mtime)
    return result
  }

  async readFile(name: string): Promise<Buffer | null> {
    const safe = basename(name)
    const filePath = join(this.outputDir, safe)
    if (!filePath.startsWith(this.outputDir) || !existsSync(filePath)) return null
    return await readFile(filePath)
  }

  async getFileStream(name: string): Promise<{ stream: ReadableStream; size: number; mime: string } | null> {
    const safe = basename(name)
    const filePath = join(this.outputDir, safe)
    if (!filePath.startsWith(this.outputDir) || !existsSync(filePath)) return null
    const s = await stat(filePath)
    const nodeStream = createReadStream(filePath)
    const mime = safe.toLowerCase().endsWith('.wav') ? 'audio/wav' : 'audio/mpeg'
    return { stream: Readable.toWeb(nodeStream) as unknown as ReadableStream, size: s.size, mime }
  }

  async deleteFile(name: string): Promise<boolean> {
    const safe = basename(name)
    const filePath = join(this.outputDir, safe)
    if (!filePath.startsWith(this.outputDir) || !existsSync(filePath)) return false
    try {
      await unlink(filePath)
      this.pushLog({
        level: 'info',
        message: `Deleted file: ${safe}`,
        ts: new Date().toISOString().slice(11, 19),
      })
      return true
    } catch {
      return false
    }
  }
}

// Per-user JobManagers — keyed by userId
const g = globalThis as unknown as { __jobsManagers?: Map<string, JobsManager> }
if (!g.__jobsManagers) g.__jobsManagers = new Map()

export function getJobs(userId: string): JobsManager {
  let m = g.__jobsManagers!.get(userId)
  if (!m) {
    m = new JobsManager(userId)
    g.__jobsManagers!.set(userId, m)
  }
  return m
}
