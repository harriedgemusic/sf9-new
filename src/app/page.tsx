'use client'

/**
 * Spotify Downloader — Web Edition
 *
 * Layout:
 *   ┌─────────────────────────────────────────────────────────┐
 *   │ HEADER: logo + title + [Settings] [Theme quick-toggle]  │
 *   │ URL INPUT ROW: [spotify url......] [Найти треки]         │
 *   ├──────────────────────────────┬──────────────────────────┤
 *   │ TRACKS (scrollable)          │ LOG (scrollable)         │
 *   ├──────────────────────────────┴──────────────────────────┤
 *   │ DOWNLOAD HISTORY (compact, scrollable)                  │
 *   ├─────────────────────────────────────────────────────────┤
 *   │ STATUS BAR (fixed): counts + clear history              │
 *   └─────────────────────────────────────────────────────────┘
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useJobsEvents } from '@/hooks/use-jobs-events'
import { useSettings } from '@/components/settings-provider'
import { useAuth } from '@/components/auth-provider'
import type {
  Track,
  DownloadedFile,
  ZipArchive,
  TrackCandidate,
} from '@/lib/spotify-types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { SettingsDialog } from '@/components/settings-dialog'
import { AdminSettingsDialog } from '@/components/admin-settings-dialog'
import { CandidatePickerDialog } from '@/components/candidate-picker-dialog'
import { ThemeToggle } from '@/components/theme-toggle'
import { useToast } from '@/hooks/use-toast'
import {
  Search,
  Download,
  Save,
  Loader2,
  Music,
  Trash2,
  AlertTriangle,
  Info,
  CircleAlert,
  CircleCheck,
  Link2,
  RefreshCw,
  Eraser,
  Cookie,
  FileArchive,
  ExternalLink,
  ListMusic,
  TerminalSquare,
  Sparkles,
  History,
  Settings as SettingsIcon,
  Zap,
  Square,
  LogOut,
  Shield,
} from 'lucide-react'
import { formatDuration, formatSize, needsExtendedMix, trackId, MAX_DURATION_SECONDS, findDownloadedFileForTrack } from '@/lib/track-utils'

export default function Home() {
  const [searchMode, setSearchMode] = useState<'extended' | 'simple'>('extended')
  const [cookiesDialogOpen, setCookiesDialogOpen] = useState(false)
  const [cookiesContent, setCookiesContent] = useState('')
  const [savingCookies, setSavingCookies] = useState(false)
  const [clearDialogIncludeCookies, setClearDialogIncludeCookies] = useState(false)
  const { user, token, logout } = useAuth()
  const {
    isConnected,
    logs,
    summary,
    downloadProgress,
    batchDoneAt,
    historyClearedAt,
    lastZip,
    cookiesRequired,
    cookiesAvailable,
    stoppedAt,
    isServerDownloading,
    fetchTracks,
    downloadTrack,
    downloadAll,
    clearLogs,
    resetSummary,
    clearHistory,
    saveCookies,
    deleteCookies,
    stop,
    downloadByUrl,
  } = useJobsEvents(token)
  const { t, audioFormat, mounted } = useSettings()
  const { toast } = useToast()

  const [url, setUrl] = useState('')
  const [fetching, setFetching] = useState(false)
  const [tracks, setTracks] = useState<Track[]>([])
  const [entityType, setEntityType] = useState<'playlist' | 'album' | 'track' | null>(null)
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set())
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set())
  const [actualFilenames, setActualFilenames] = useState<Map<string, string>>(new Map())
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set())
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set())
  const [batchDownloading, setBatchDownloading] = useState(false)
  const [files, setFiles] = useState<DownloadedFile[]>([])
  const [archives, setArchives] = useState<ZipArchive[]>([])
  const [refreshingFiles, setRefreshingFiles] = useState(false)

  const userIdKey = user?.id || user?.username
  const storageKey = userIdKey ? `sf9_playlist_state_${userIdKey}` : 'sf9_playlist_state_guest'

  const restoredKeyRef = useRef<string | null>(null)

  // Restore playlist state from localStorage when mounted or user changes
  useEffect(() => {
    if (!mounted) return
    if (restoredKeyRef.current === storageKey) return
    restoredKeyRef.current = storageKey

    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        setUrl(parsed.url || '')
        setEntityType(parsed.entityType || null)
        setTracks(Array.isArray(parsed.tracks) ? parsed.tracks : [])
        if (parsed.searchMode === 'extended' || parsed.searchMode === 'simple') {
          setSearchMode(parsed.searchMode)
        }
        setDownloadedIds(new Set(Array.isArray(parsed.downloadedIds) ? parsed.downloadedIds : []))
        setFailedIds(new Set(Array.isArray(parsed.failedIds) ? parsed.failedIds : []))
        setSkippedIds(new Set(Array.isArray(parsed.skippedIds) ? parsed.skippedIds : []))
        setActualFilenames(
          parsed.actualFilenames && typeof parsed.actualFilenames === 'object'
            ? new Map(Object.entries(parsed.actualFilenames))
            : new Map()
        )
      } else {
        setUrl('')
        setEntityType(null)
        setTracks([])
        setDownloadedIds(new Set())
        setFailedIds(new Set())
        setSkippedIds(new Set())
        setActualFilenames(new Map())
      }
    } catch {
      // ignore parse error
    }
  }, [mounted, storageKey])

  // Save playlist state to localStorage on updates
  useEffect(() => {
    if (!mounted || restoredKeyRef.current !== storageKey) return
    if (tracks.length === 0 && !url) {
      try { localStorage.removeItem(storageKey) } catch {}
      return
    }
    try {
      const payload = {
        url,
        entityType,
        tracks,
        searchMode,
        downloadedIds: Array.from(downloadedIds),
        failedIds: Array.from(failedIds),
        skippedIds: Array.from(skippedIds),
        actualFilenames: Object.fromEntries(actualFilenames.entries()),
      }
      localStorage.setItem(storageKey, JSON.stringify(payload))
    } catch {
      // ignore storage error
    }
  }, [mounted, storageKey, url, entityType, tracks, searchMode, downloadedIds, failedIds, skippedIds, actualFilenames])

  // Sync batchDownloading loading state with server job status
  useEffect(() => {
    if (isServerDownloading) {
      setBatchDownloading(true)
    }
  }, [isServerDownloading])

  // Cross-reference tracks against downloaded files on disk
  useEffect(() => {
    if (!tracks || tracks.length === 0 || !files || files.length === 0) return
    let changed = false
    const newDownloadedIds = new Set(downloadedIds)
    const newActualFilenames = new Map(actualFilenames)

    for (const track of tracks) {
      const id = trackId(track)
      const matchedFile = findDownloadedFileForTrack(track, files, newActualFilenames.get(id))
      if (matchedFile) {
        if (!newDownloadedIds.has(id)) {
          newDownloadedIds.add(id)
          changed = true
        }
        if (newActualFilenames.get(id) !== matchedFile.name) {
          newActualFilenames.set(id, matchedFile.name)
          changed = true
        }
      }
    }

    if (changed) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setDownloadedIds(newDownloadedIds)
      setActualFilenames(newActualFilenames)
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [tracks, files])

  // Settings dialog state
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)

  // Candidate picker dialog state
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerCandidates, setPickerCandidates] = useState<TrackCandidate[]>([])
  const [pickerTrack, setPickerTrack] = useState<{ artist: string; title: string } | null>(null)
  const [pickerDownloadingUrl, setPickerDownloadingUrl] = useState<string | null>(null)

  // Cookies dialog state
      
  // Clear-history confirmation dialog
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
    const [clearing, setClearing] = useState(false)

  const logScrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll the log panel to the bottom on new entries
  useEffect(() => {
    if (logScrollRef.current) {
      logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight
    }
  }, [logs])

  // React to download progress events from SSE
  useEffect(() => {
    if (!downloadProgress) return
    const id = trackId(downloadProgress.track)
    /* eslint-disable react-hooks/set-state-in-effect */
    setDownloadingIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    if (downloadProgress.result?.status === 'downloaded') {
      setDownloadedIds((prev) => new Set(prev).add(id))
      if (downloadProgress.result.file) {
        setActualFilenames((prev) => {
          const next = new Map(prev)
          next.set(id, downloadProgress.result!.file as string)
          return next
        })
      }
      refreshFiles()
    } else if (downloadProgress.result?.status === 'skipped') {
      setSkippedIds((prev) => new Set(prev).add(id))
    } else if (downloadProgress.result?.status === 'needs_pick') {
      // Extended search found candidates but none passed the duration
      // filter — open the picker dialog so the user can choose manually.
      const candidates = downloadProgress.result?.candidates || []
      if (candidates.length > 0) {
        setPickerCandidates(candidates)
        setPickerTrack({
          artist: downloadProgress.track.artist,
          title: downloadProgress.track.title,
        })
        setPickerOpen(true)
      }
    } else {
      setFailedIds((prev) => new Set(prev).add(id))
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [downloadProgress])

  // React to stop events
  useEffect(() => {
    if (stoppedAt === null) return
    /* eslint-disable react-hooks/set-state-in-effect */
    setFetching(false)
    setBatchDownloading(false)
    setDownloadingIds(new Set())
    toast({
      title: t.stopped,
    })
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [stoppedAt])

  // React to batch-done events
  useEffect(() => {
    if (batchDoneAt === null) return
    /* eslint-disable react-hooks/set-state-in-effect */
    setBatchDownloading(false)
    refreshFiles()
    toast({
      title: t.toastBatchComplete,
      description: t.toastBatchCompleteDesc(summary.downloaded, summary.skipped, summary.failed),
    })
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [batchDoneAt])

  // When the cookies-required SSE event arrives, auto-open the cookies dialog
  useEffect(() => {
    if (cookiesRequired && !cookiesAvailable) {
      setCookiesDialogOpen(true)
    }
  }, [cookiesRequired, cookiesAvailable])

  // Refresh file list when history is cleared
  useEffect(() => {
    if (historyClearedAt === null) return
    /* eslint-disable react-hooks/set-state-in-effect */
    setFiles([])
    setArchives([])
    setDownloadedIds(new Set())
    setActualFilenames(new Map())
    setFailedIds(new Set())
    setSkippedIds(new Set())
    setDownloadingIds(new Set())
    setBatchDownloading(false)
    try { localStorage.removeItem(storageKey) } catch {}
    toast({
      title: t.toastHistoryCleared,
      description: t.toastHistoryClearedDesc,
    })
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [historyClearedAt])

  // Initial file list load
  useEffect(() => {
    refreshFiles()
  }, [])

  async function refreshFiles() {
    setRefreshingFiles(true)
    try {
      const r = await fetch('/api/spotify/files', {
        cache: 'no-store',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await r.json()
      if (data.ok) {
        setFiles(data.files || [])
        setArchives(data.archives || [])
      }
    } catch {
      // ignore
    } finally {
      setRefreshingFiles(false)
    }
  }

  const handleFetch = useCallback(async () => {
    const trimmed = url.trim()
    if (!trimmed) {
      toast({ title: t.toastEnterUrl, description: t.toastEnterUrlDesc, variant: 'destructive' })
      return
    }
    if (!/spotify\.com\/(playlist|album|track)\//.test(trimmed) && !/^spotify:(track|album|playlist):/.test(trimmed)) {
      toast({ title: t.toastInvalidUrl, description: t.toastInvalidUrlDesc, variant: 'destructive' })
      return
    }

    setFetching(true)
    setTracks([])
    setDownloadedIds(new Set())
    setFailedIds(new Set())
    setSkippedIds(new Set())

    try {
      const result = await fetchTracks(trimmed)
      if (result?.ok && result.tracks) {
        setEntityType(result.entity_type ?? null)
        setTracks(result.tracks)
        // Albums are always downloaded in simple mode (no extended-mix lookup)
        // per user requirement — the original album versions are what the user
        // wants, not extended remixes.
        if (result.entity_type === 'album') {
          setSearchMode('simple')
        }
        toast({
          title: t.toastTracksFound(result.tracks.length),
          description: result.entity_type === 'playlist'
            ? t.toastPlaylistLoaded
            : result.entity_type === 'album'
            ? t.albumLoaded
            : t.toastTrackReceived,
        })
      } else {
        toast({
          title: t.toastFetchError,
          description: result?.error ?? '',
          variant: 'destructive',
        })
      }
    } catch (e: any) {
      toast({
        title: t.toastRequestError,
        description: e.message,
        variant: 'destructive',
      })
    } finally {
      setFetching(false)
    }
  }, [url, fetchTracks, toast, t])

  const handleDownload = useCallback(async (track: Track) => {
    const id = trackId(track)
    setDownloadingIds((prev) => new Set(prev).add(id))
    setDownloadedIds((prev) => { const n = new Set(prev); n.delete(id); return n })
    setFailedIds((prev) => { const n = new Set(prev); n.delete(id); return n })
    setSkippedIds((prev) => { const n = new Set(prev); n.delete(id); return n })

    try {
      const result = await downloadTrack(track, audioFormat, searchMode as any, undefined as any)
      if (result?.status === 'skipped') {
        toast({
          title: t.toastTrackSkipped,
          description: t.toastTrackSkippedDesc(track.artist, track.title),
        })
      } else if (result?.status === 'downloaded') {
        toast({
          title: t.toastTrackDownloaded,
          description: t.toastTrackDownloadedDesc(track.artist, track.title),
        })
      } else if (!result?.ok) {
        toast({
          title: t.toastDownloadFailed,
          description: `${track.artist} — ${track.title}`,
          variant: 'destructive',
        })
      }
    } catch (e: any) {
      setDownloadingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      setFailedIds((prev) => new Set(prev).add(id))
      toast({
        title: t.toastRequestError,
        description: e.message,
        variant: 'destructive',
      })
    }
  }, [downloadTrack, toast, t, audioFormat, searchMode])

  const handleDownloadAll = useCallback(async () => {
    if (tracks.length === 0) return
    setBatchDownloading(true)
    setDownloadedIds(new Set())
    setFailedIds(new Set())
    setSkippedIds(new Set())
    await resetSummary()

    try {
      await downloadAll(tracks, audioFormat, searchMode as any, undefined as any)
    } catch (e: any) {
      setBatchDownloading(false)
      toast({
        title: t.toastBatchStartError,
        description: e.message,
        variant: 'destructive',
      })
    }
  }, [tracks, downloadAll, resetSummary, toast, t, audioFormat, searchMode])

  const handleDeleteFile = useCallback(async (name: string) => {
    try {
      const r = await fetch(`/api/spotify/delete?name=${encodeURIComponent(name)}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await r.json()
      if (data.ok) {
        setFiles((prev) => prev.filter((f) => f.name !== name))
        toast({ title: t.toastFileDeleted, description: name })
      } else {
        toast({ title: t.toastDeleteError, description: data.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: t.toastDeleteError, description: e.message, variant: 'destructive' })
    }
  }, [toast, t])

  const handleClearHistory = useCallback(async () => {
    setClearing(true)
    try {
      const result = await clearHistory({ deleteCookies: clearDialogIncludeCookies })
      if (result.ok) {
        setClearDialogOpen(false)
      } else {
        toast({ title: t.toastClearError, description: '', variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: t.toastClearError, description: e.message, variant: 'destructive' })
    } finally {
      setClearing(false)
    }
  }, [clearHistory, clearDialogIncludeCookies, toast, t])

  const handleSaveCookies = useCallback(async () => {
    const trimmed = cookiesContent.trim()
    if (!trimmed) {
      toast({ title: t.toastCookiesEmpty, description: t.toastCookiesEmptyDesc, variant: 'destructive' })
      return
    }
    if (!trimmed.startsWith('# Netscape HTTP Cookie File')) {
      toast({
        title: t.toastCookiesInvalid,
        description: t.toastCookiesInvalidDesc,
        variant: 'destructive',
      })
      return
    }
    setSavingCookies(true)
    try {
      const result = await saveCookies(trimmed)
      if (result.ok) {
        toast({
          title: t.toastCookiesSaved,
          description: t.toastCookiesSavedDesc,
        })
        setCookiesDialogOpen(false)
        setCookiesContent('')
      } else {
        toast({ title: t.toastCookiesSaveError, description: result.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: t.toastCookiesSaveError, description: e.message, variant: 'destructive' })
    } finally {
      setSavingCookies(false)
    }
  }, [cookiesContent,  toast, t])

  const handleDeleteCookies = useCallback(async () => {
    try {
      await deleteCookies()
      toast({ title: t.toastCookiesDeleted })
    } catch (e: any) {
      toast({ title: t.toastCookiesDeleteError, description: e.message, variant: 'destructive' })
    }
  }, [ toast, t])

  const handleStop = useCallback(async () => {
    try {
      await stop()
      // The stopped SSE event will reset fetching/batchDownloading flags
    } catch (e: any) {
      toast({ title: t.stopped, description: e.message, variant: 'destructive' })
    }
  }, [stop, toast, t])

  const handlePickCandidate = useCallback(async (candidate: TrackCandidate) => {
    if (!pickerTrack) return
    setPickerDownloadingUrl(candidate.url)
    try {
      const result = await downloadByUrl(
        candidate.url,
        pickerTrack.artist,
        // Use the candidate's title as the file title so the downloaded
        // file reflects what the user actually picked.
        candidate.title,
        audioFormat,
      )
      if (result?.status === 'downloaded') {
        toast({
          title: t.toastTrackDownloaded,
          description: `${pickerTrack.artist} — ${candidate.title}`,
        })
        setPickerOpen(false)
        refreshFiles()
      } else if (!result?.ok) {
        toast({
          title: t.toastDownloadFailed,
          description: candidate.title,
          variant: 'destructive',
        })
      }
    } catch (e: any) {
      toast({
        title: t.toastRequestError,
        description: e.message,
        variant: 'destructive',
      })
    } finally {
      setPickerDownloadingUrl(null)
    }
  }, [pickerTrack, downloadByUrl, audioFormat, toast, t])

  const errorCount = logs.filter((l) => l.level === 'error').length
  const warningCount = logs.filter((l) => l.level === 'warning').length
  const infoCount = logs.filter((l) => l.level === 'info').length

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* ============ HEADER ============ */}
      <header className="shrink-0 border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/logo.svg"
              alt="Beatspotto"
              className="size-9 rounded-lg shadow-md shadow-emerald-500/20 shrink-0 object-cover"
            />
            <div className="min-w-0">
              <h1 className="text-lg font-bold tracking-tight truncate flex items-center gap-2">
                {t.appTitle}
                <Badge variant="secondary" className="text-[10px] py-0 h-4 hidden sm:inline-flex">Web</Badge>
              </h1>
              <p className="text-xs text-muted-foreground truncate hidden sm:block">
                {t.appSubtitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Mode toggle: Search Extended vs Simple
                We render with the actual searchMode only after mount to
                avoid hydration mismatch (server renders 'extended', client
                may have 'simple' in localStorage). Before mount, both
                buttons are rendered without the active style. */}
            <div
              className="flex items-center rounded-md border border-border p-0.5 bg-muted/30"
              role="group"
              aria-label={t.searchMode}
              suppressHydrationWarning
            >
              <button
                type="button"
                onClick={() => setSearchMode('extended')}
                className={`h-7 px-2.5 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
                  mounted && searchMode === 'extended'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title={t.searchModeExtendedDesc}
                aria-pressed={mounted ? searchMode === 'extended' : false}
              >
                <Zap className="size-3.5" />
                <span className="hidden sm:inline">{t.modeToggleExtended}</span>
              </button>
              <button
                type="button"
                onClick={() => setSearchMode('simple')}
                className={`h-7 px-2.5 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
                  mounted && searchMode === 'simple'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title={t.searchModeSimpleDesc}
                aria-pressed={mounted ? searchMode === 'simple' : false}
              >
                <Download className="size-3.5" />
                <span className="hidden sm:inline">{t.modeToggleSimple}</span>
              </button>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-9"
              onClick={() => setSettingsOpen(true)}
              title={t.settings}
              aria-label={t.settings}
            >
              <SettingsIcon className="size-4" />
            </Button>
            {mounted && (user?.isAdmin || user?.username === 'admin') && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-8 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 font-semibold"
                onClick={() => setAdminOpen(true)}
                title="Настройки администратора"
              >
                <Shield className="size-3.5" />
                <span>Admin</span>
              </Button>
            )}
            <ThemeToggle
              darkLabel={t.themeLight}
              lightLabel={t.themeDark}
              ariaLabel={t.theme}
            />
            <Button
              variant="ghost"
              size="icon"
              className="size-9 text-muted-foreground hover:text-destructive"
              onClick={logout}
              title="Logout"
              aria-label="Logout"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>

        {/* URL INPUT ROW */}
        <div className="px-4 sm:px-6 pb-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !fetching) handleFetch() }}
                placeholder={t.urlPlaceholder}
                disabled={fetching}
                className="font-mono text-sm pl-9 h-10"
              />
            </div>
            <Button
              onClick={handleFetch}
              disabled={fetching || !url.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 sm:w-44 shrink-0"
            >
              {fetching ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Search className="size-4 mr-2" />}
              {fetching ? t.searching : t.findTracks}
            </Button>
            {/* Stop button — visible when there's an in-flight operation */}
            {(fetching || batchDownloading || downloadingIds.size > 0) && (
              <Button
                onClick={handleStop}
                variant="destructive"
                className="h-10 px-4 shrink-0"
                title={t.stopTitle}
              >
                <Square className="size-4 mr-2" />
                {t.stop}
              </Button>
            )}
          </div>
          {cookiesRequired && !cookiesAvailable && (
            <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 p-2.5 flex items-center gap-2.5">
              <CircleAlert className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <p className="text-xs text-amber-900 dark:text-amber-200 flex-1 min-w-0">
                {t.cookiesRequiredBanner}
              </p>
              <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => setCookiesDialogOpen(true)}>
                {t.insertCookies}
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* ============ MAIN: 2-COLUMN GRID ============ */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-px bg-border overflow-hidden">
        {/* LEFT: TRACKS */}
        <section className="bg-background flex flex-col min-h-0 overflow-hidden">
          <div className="shrink-0 px-4 py-2.5 border-b border-border flex items-center justify-between gap-2 bg-card/30">
            <div className="flex items-center gap-2 min-w-0">
              <ListMusic className="size-4 text-emerald-500 shrink-0" />
              <h2 className="text-sm font-semibold truncate">{t.tracks}</h2>
              {tracks.length > 0 && (
                <Badge variant="secondary" className="text-[10px] py-0 h-4.5">{t.trackCount(tracks.length)}</Badge>
              )}
              {entityType && tracks.length > 0 && (
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  · {entityType === 'playlist' ? t.playlistSource : entityType === 'album' ? t.albumSource : t.singleTrackSource}
                </span>
              )}
            </div>
            {tracks.length > 0 && (
              <Button
                onClick={handleDownloadAll}
                disabled={batchDownloading}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white h-8"
              >
                {batchDownloading ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Download className="size-3.5 mr-1.5" />}
                {batchDownloading ? t.downloadingAll : t.downloadAll}
              </Button>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {tracks.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground p-6">
                {fetching ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="size-7 animate-spin text-emerald-500" />
                    <p>{t.fetchingMetadata}</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-center">
                    <Sparkles className="size-9 text-muted-foreground/40" />
                    <p>{t.enterUrlPrompt}</p>
                  </div>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {tracks.map((track, idx) => {
                  const id = trackId(track)
                  const isDownloading = downloadingIds.has(id)
                  const isDownloaded = downloadedIds.has(id)
                  const isFailed = failedIds.has(id)
                  const isSkipped = skippedIds.has(id)
                  const needsExt = needsExtendedMix(track)
                  const ext = audioFormat === 'wav-16-44100' ? '.wav' : '.mp3'
                  // Build the expected filename for the "Save" link
                  const expectedTitle = needsExt || (track.duration_ms / 1000 < MAX_DURATION_SECONDS)
                    ? `${track.title} (Extended Mix)`
                    : track.title
                  const expectedFilename = `${track.artist} - ${expectedTitle}`.replace(/[<>:"/\\|?*]/g, '_') + ext
                  return (
                    <li
                      key={`${id}-${idx}`}
                      className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                        isDownloaded ? 'bg-emerald-500/5' :
                        isFailed ? 'bg-destructive/5' :
                        isSkipped ? 'bg-amber-500/5' : ''
                      } hover:bg-accent/40`}
                    >
                      {/* Cover */}
                      <div className="size-10 shrink-0 rounded-md overflow-hidden bg-muted flex items-center justify-center">
                        {track.cover_url ? (
                          <img
                            src={track.cover_url}
                            alt=""
                            className="size-full object-cover"
                            loading="lazy"
                            onError={(e) => {
                              ;(e.target as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        ) : (
                          <Music className="size-4 text-muted-foreground" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-medium truncate max-w-full">{track.title}</p>
                          {needsExt && (
                            <Badge variant="outline" className="text-[9px] py-0 h-3.5 border-emerald-500/50 text-emerald-600 dark:text-emerald-400 shrink-0">
                              {t.extBadge}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span className="truncate">{track.artist}</span>
                          <span className="font-mono shrink-0">{formatDuration(track.duration_ms)}</span>
                          {track.spotify_url && (
                            <a
                              href={track.spotify_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-emerald-500 shrink-0"
                              title="Spotify"
                            >
                              <Link2 className="size-3" />
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Status + Action */}
                      <div className="shrink-0 flex items-center gap-2">
                        {isDownloading ? (
                          <Badge variant="secondary" className="gap-1 py-0.5">
                            <Loader2 className="size-3 animate-spin" /> {t.downloading}
                          </Badge>
                        ) : isDownloaded ? (
                          <>
                            <Badge variant="default" className="bg-emerald-600 gap-1 py-0.5">
                              <CircleCheck className="size-3" /> {t.downloaded}
                            </Badge>
                            <a href={`/api/spotify/file?name=${encodeURIComponent(actualFilenames.get(id) || expectedFilename)}&token=${token || ''}`} download>
                              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs">
                                <Save className="size-3.5" /> {t.save}
                              </Button>
                            </a>
                          </>
                        ) : isSkipped ? (
                          <Badge variant="outline" className="gap-1 py-0.5 border-amber-500/50 text-amber-600 dark:text-amber-400">
                            {t.skipped}
                          </Badge>
                        ) : isFailed ? (
                          <>
                            <Badge variant="destructive" className="gap-1 py-0.5">
                              <CircleAlert className="size-3" /> {t.failed}
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => handleDownload(track)}
                              disabled={batchDownloading}
                            >
                              {t.retry}
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownload(track)}
                            disabled={batchDownloading}
                            className="h-7 gap-1 text-xs"
                          >
                            <Download className="size-3.5" /> {t.download}
                          </Button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>

        {/* RIGHT: LOG */}
        <section className="bg-background flex flex-col min-h-0 overflow-hidden">
          <div className="shrink-0 px-4 py-2.5 border-b border-border flex items-center justify-between gap-2 bg-card/30">
            <div className="flex items-center gap-2 min-w-0">
              <TerminalSquare className="size-4 text-emerald-500 shrink-0" />
              <h2 className="text-sm font-semibold truncate">{t.eventLog}</h2>
              <Badge variant="outline" className="text-[10px] py-0 h-4.5 gap-1">
                <span className={`size-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'}`} />
                {isConnected ? t.online : t.offline}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5 text-[10px]">
              <Badge variant="outline" className="py-0 h-5 gap-1 text-blue-600 dark:text-blue-400 border-blue-500/30">
                <Info className="size-3" /> {infoCount}
              </Badge>
              <Badge variant="outline" className="py-0 h-5 gap-1 text-amber-600 dark:text-amber-400 border-amber-500/30">
                <AlertTriangle className="size-3" /> {warningCount}
              </Badge>
              <Badge variant="outline" className="py-0 h-5 gap-1 text-red-600 dark:text-red-400 border-red-500/30">
                <CircleAlert className="size-3" /> {errorCount}
              </Badge>
              <Button size="icon" variant="ghost" className="size-7" onClick={clearLogs} title={t.clearLog}>
                <Eraser className="size-3.5" />
              </Button>
            </div>
          </div>

          <div
            ref={logScrollRef}
            className="flex-1 min-h-0 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 p-3 font-mono text-xs leading-relaxed log-scroll border-t border-border"
          >
            {logs.length === 0 ? (
              <div className="text-zinc-500 dark:text-zinc-500 italic h-full flex items-center justify-center text-center whitespace-pre-line">
                {t.logEmpty}
              </div>
            ) : (
              logs.map((entry, idx) => (
                <div
                  key={idx}
                  className={`flex gap-2 py-0.5 border-b border-zinc-200 dark:border-zinc-900/50 ${
                    entry.level === 'error'
                      ? 'text-red-700 dark:text-red-400'
                      : entry.level === 'warning'
                      ? 'text-amber-700 dark:text-amber-300'
                      : 'text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  <span className="text-zinc-400 dark:text-zinc-600 shrink-0">{entry.ts}</span>
                  <span className="shrink-0 font-bold w-3">
                    {entry.level === 'error' ? 'E' : entry.level === 'warning' ? 'W' : 'I'}
                  </span>
                  <span className="break-all">{entry.message}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* ============ DOWNLOAD HISTORY (compact) ============ */}
      <section className="shrink-0 border-t border-border bg-card/30 max-h-48 flex flex-col overflow-hidden">
        <div className="shrink-0 px-4 py-2 border-b border-border flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <History className="size-4 text-emerald-500 shrink-0" />
            <h2 className="text-sm font-semibold truncate">{t.downloadHistory}</h2>
            {archives.length > 0 && (
              <Badge variant="outline" className="text-[10px] py-0 h-4.5 gap-1 border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                <FileArchive className="size-3" /> {t.archiveCount(archives.length)}
              </Badge>
            )}
            {files.length > 0 && (
              <Badge variant="secondary" className="text-[10px] py-0 h-4.5">{t.mp3Count(files.length)}</Badge>
            )}
          </div>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={refreshFiles} disabled={refreshingFiles} title={t.refresh}>
            {refreshingFiles ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          </Button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {files.length === 0 && archives.length === 0 ? (
            <div className="py-4 text-center text-xs text-muted-foreground">
              {t.historyEmpty}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {/* Archives first */}
              {archives.map((a) => (
                <li key={a.name} className={`flex items-center gap-2.5 px-4 py-1.5 hover:bg-accent/40 ${lastZip?.name === a.name ? 'bg-emerald-500/5' : ''}`}>
                  <div className="size-7 shrink-0 rounded bg-emerald-500/10 flex items-center justify-center">
                    <FileArchive className="size-3.5 text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" title={a.name}>{a.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatSize(a.size)} · {new Date(a.mtime).toLocaleString()}
                      {lastZip?.name === a.name && <span className="ml-1 text-emerald-500">· {t.lastArchive}</span>}
                    </p>
                  </div>
                  <a href={`/api/spotify/archive?name=${encodeURIComponent(a.name)}&token=${token || ''}`} download>
                    <Button size="sm" variant="outline" className="h-6 gap-1 text-[11px] bg-emerald-600 text-white hover:bg-emerald-700">
                      <Download className="size-3" /> ZIP
                    </Button>
                  </a>
                </li>
              ))}
              {/* Audio files (mp3 + wav) */}
              {files.map((f) => {
                const isWav = f.name.toLowerCase().endsWith('.wav')
                return (
                  <li key={f.name} className="flex items-center gap-2.5 px-4 py-1.5 hover:bg-accent/40">
                    <div className="size-7 shrink-0 rounded bg-muted flex items-center justify-center">
                      <Music className="size-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" title={f.name}>{f.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatSize(f.size)} · {new Date(f.mtime).toLocaleTimeString()}
                      </p>
                    </div>
                    {isWav && (
                      <Badge variant="outline" className="text-[9px] py-0 h-4 border-blue-500/40 text-blue-600 dark:text-blue-400">
                        WAV
                      </Badge>
                    )}
                    <a href={`/api/spotify/file?name=${encodeURIComponent(f.name)}&token=${token || ''}`} download>
                      <Button size="sm" variant="ghost" className="h-6 w-7 p-0" title={t.save}>
                        <Save className="size-3.5" />
                      </Button>
                    </a>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteFile(f.name)}
                      title={t.delete}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>

      {/* ============ FIXED STATUS BAR ============ */}
      <footer className="shrink-0 border-t border-border bg-card/80 backdrop-blur-sm">
        <div className="px-4 py-2 flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 overflow-x-auto">
            <StatusStat label={t.total} value={summary.total} tone="default" />
            <StatusStat label={t.ok} value={summary.downloaded} tone="ok" />
            <StatusStat label={t.skip} value={summary.skipped} tone="warn" />
            <StatusStat label={t.error} value={summary.failed} tone="err" />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {batchDownloading && (
              <Badge variant="secondary" className="gap-1.5 py-1">
                <Loader2 className="size-3 animate-spin" /> {t.batchInProgress}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setClearDialogOpen(true)}
              disabled={clearing || batchDownloading}
              title={t.clear}
            >
              <Trash2 className="size-4" />
              <span className="hidden sm:inline">{t.clear}</span>
            </Button>
          </div>
        </div>
      </footer>

      {/* ============ SETTINGS DIALOG ============ */}
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />

      {/* ============ ADMIN SETTINGS DIALOG ============ */}
      <AdminSettingsDialog
        open={adminOpen}
        onOpenChange={setAdminOpen}
      />

      {/* ============ CANDIDATE PICKER DIALOG ============ */}
      <CandidatePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        candidates={pickerCandidates}
        trackTitle={pickerTrack?.title || ''}
        trackArtist={pickerTrack?.artist || ''}
        onPick={handlePickCandidate}
        downloadingUrl={pickerDownloadingUrl}
      />

      {/* ============ COOKIES DIALOG ============ */}
      <Dialog open={cookiesDialogOpen} onOpenChange={setCookiesDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cookie className="size-5 text-emerald-500" />
              {t.cookiesDialogTitle}
              {cookiesAvailable && (
                <Badge variant="default" className="bg-emerald-600 ml-1">ON</Badge>
              )}
            </DialogTitle>
            <DialogDescription>{t.cookiesDialogDescription}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-md border border-border bg-muted/50 p-3 text-xs space-y-2">
              <p className="font-semibold">{t.howToGetCookies}</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>
                  {t.cookiesStep1}
                  <div className="ml-4 mt-1 flex flex-col gap-1">
                    <a href="https://chromewebstore.google.com/detail/get-cookies-txt-locally/cclelndahbckbenkjhflpdbgdldlbecc" target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1">
                      <ExternalLink className="size-3" /> {t.cookiesChromeExt}
                    </a>
                    <a href="https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/" target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1">
                      <ExternalLink className="size-3" /> {t.cookiesFirefoxExt}
                    </a>
                  </div>
                </li>
                <li>{t.cookiesStep2}</li>
                <li>
                  {t.cookiesStep3} <code className="px-1 py-0.5 rounded bg-muted">https://www.youtube.com</code> {t.cookiesStep3Site}
                </li>
                <li>{t.cookiesStep4}</li>
              </ol>
              <p className="text-amber-700 dark:text-amber-400 mt-2 flex items-start gap-1">
                <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                <span>{t.cookiesSecurityNote}</span>
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {t.cookiesContentLabel}
              </label>
              <Textarea
                value={cookiesContent}
                onChange={(e) => setCookiesContent(e.target.value)}
                placeholder={t.cookiesContentPlaceholder}
                className="font-mono text-xs h-40 resize-y"
              />
              <p className="text-[11px] text-muted-foreground">
                {t.cookiesFirstLineHint}
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            {cookiesAvailable && (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive mr-auto"
                onClick={handleDeleteCookies}
              >
                <Trash2 className="size-4 mr-1" /> {t.deleteCookies}
              </Button>
            )}
            <Button variant="outline" onClick={() => setCookiesDialogOpen(false)}>
              {t.cancel}
            </Button>
            <Button
              onClick={handleSaveCookies}
              disabled={savingCookies || !cookiesContent.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {savingCookies ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Cookie className="size-4 mr-1" />}
              {t.saveBtn}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ CLEAR HISTORY CONFIRMATION ============ */}
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <History className="size-5 text-destructive" />
              {t.clearHistoryTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t.clearHistoryWarning}
              <span className="block mt-2 ml-4">{t.clearHistoryFiles(files.length)}</span>
              <span className="block ml-4">{t.clearHistoryArchives(archives.length)}</span>
              <span className="block ml-4">{t.clearHistoryLogs(logs.length)}</span>
              <span className="block ml-4">{t.clearHistoryCounters}</span>
              <span className="block mt-2 text-amber-700 dark:text-amber-400">
                {t.clearHistoryIrreversible}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none px-1">
            <input
              type="checkbox"
              checked={clearDialogIncludeCookies}
              onChange={(e) => setClearDialogIncludeCookies(e.target.checked)}
              className="size-4 rounded border-border"
            />
            <span>{t.clearHistoryAlsoCookies}</span>
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearing}>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearHistory}
              disabled={clearing}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {clearing ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Trash2 className="size-4 mr-1" />}
              {t.clearAll}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <style jsx global>{`
        .log-scroll::-webkit-scrollbar {
          width: 6px;
        }
        /* Light theme scrollbar (default) */
        .log-scroll::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.05);
        }
        .log-scroll::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.2);
          border-radius: 3px;
        }
        .log-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(0,0,0,0.35);
        }
        /* Dark theme scrollbar overrides */
        .dark .log-scroll::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.2);
        }
        .dark .log-scroll::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.15);
          border-radius: 3px;
        }
        .dark .log-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.25);
        }
      `}</style>
    </div>
  )
}

function StatusStat({ label, value, tone }: { label: string; value: number; tone: 'default' | 'ok' | 'warn' | 'err' }) {
  const cls = {
    default: 'text-muted-foreground',
    ok: 'text-emerald-500',
    warn: 'text-amber-500',
    err: 'text-destructive',
  }[tone]
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className={`text-base font-bold tabular-nums ${cls}`}>{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  )
}
