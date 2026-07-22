'use client'

/**
 * Spotify Downloader — Web Edition (Refactored Container Page)
 *
 * Modular Architecture:
 *   - HeaderBar: URL input, search mode, settings & quick controls
 *   - TrackList: Displays fetched Spotify tracks and candidate pickers
 *   - LogPanel: Real-time execution logs and severity filters
 *   - DownloadHistoryPanel: Downloaded files and zip archives
 *   - PlayerBar: Audio playback preview bar
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
  SearchMode,
} from '@/lib/spotify-types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
import { HeaderBar } from '@/components/main-app/header-bar'
import { TrackList } from '@/components/main-app/track-list'
import { LogPanel } from '@/components/main-app/log-panel'
import { DownloadHistoryPanel } from '@/components/main-app/download-history-panel'
import { PlayerBar } from '@/components/main-app/player-bar'
import { useToast } from '@/hooks/use-toast'

export default function Home() {
  const { user, token, logout } = useAuth()
  const { audioFormat, t } = useSettings()
  const { toast } = useToast()

  // State
  const [url, setUrl] = useState('')
  const [searchMode, setSearchMode] = useState<SearchMode>('extended')
  const [tracks, setTracks] = useState<Track[]>([])
  const [isFetching, setIsFetching] = useState(false)
  const [files, setFiles] = useState<DownloadedFile[]>([])
  const [zips, setZips] = useState<ZipArchive[]>([])

  // Download Status Maps
  const [downloadStatus, setDownloadStatus] = useState<
    Record<string, 'downloading' | 'done' | 'failed' | 'needs_pick'>
  >({})
  const [downloadedFilesMap, setDownloadedFilesMap] = useState<Record<string, string>>({})

  // Modals & Dialogs State
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [adminSettingsOpen, setAdminSettingsOpen] = useState(false)
  const [candidatePickerOpen, setCandidatePickerOpen] = useState(false)
  const [currentCandidates, setCurrentCandidates] = useState<TrackCandidate[]>([])
  const [currentCandidateTrack, setCurrentCandidateTrack] = useState<{
    title: string
    artist: string
  } | null>(null)
  const [downloadingCandidateUrl, setDownloadingCandidateUrl] = useState<string | null>(null)

  // Cookies Dialog State
  const [cookiesDialogOpen, setCookiesDialogOpen] = useState(false)
  const [cookiesContent, setCookiesContent] = useState('')
  const [savingCookies, setSavingCookies] = useState(false)

  // Clear History Dialog State
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const [clearDialogIncludeCookies, setClearDialogIncludeCookies] = useState(false)
  const [clearing, setClearing] = useState(false)

  // Audio Player State
  const [previewTrackTitle, setPreviewTrackTitle] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [isMuted, setIsMuted] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Subscriptions & Job Events
  const {
    logs,
    summary,
    isServerDownloading,
    cookiesRequired,
    fetchTracks,
    downloadTrack,
    downloadAll,
    stop,
    clearLogs,
    saveCookies,
    deleteCookies,
    clearHistory,
    resetSummary,
  } = useJobsEvents(token)

  const isDownloading = isServerDownloading


  // Load Downloaded Files List
  const refreshFiles = useCallback(async () => {
    try {
      const res = await fetch('/api/spotify/files', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) {
        const data = await res.json()
        setFiles(data.files || [])
        setZips(data.zips || [])

        // Update downloadedFilesMap
        const map: Record<string, string> = {}
        for (const file of data.files || []) {
          map[file.name] = file.name
        }
        setDownloadedFilesMap(map)
      }
    } catch {
      // quiet fail
    }
  }, [token])

  useEffect(() => {
    void refreshFiles()
  }, [refreshFiles])

  // Prompt Cookies Dialog when server requests cookies
  useEffect(() => {
    if (cookiesRequired) {
      setCookiesDialogOpen(true)
    }
  }, [cookiesRequired])

  // Fetch Spotify Tracks
  const handleFetch = useCallback(async () => {
    if (!url.trim()) return
    setIsFetching(true)
    setTracks([])
    try {
      const result = await fetchTracks(url)
      if (result.ok && result.tracks) {
        setTracks(result.tracks)
        toast({
          title: t.tracks || 'Tracks Loaded',
          description: `${result.tracks.length} tracks found`,
        })
      } else {
        toast({
          title: t.toastFetchError || 'Error fetching tracks',
          description: result.error || 'Failed to fetch tracks',
          variant: 'destructive',
        })
      }
    } catch (e: any) {
      toast({
        title: t.toastFetchError || 'Error fetching tracks',
        description: e.message,
        variant: 'destructive',
      })
    } finally {
      setIsFetching(false)
    }
  }, [url, fetchTracks, toast, t])

  // Download Single Track
  const handleDownloadSingle = useCallback(
    async (track: Track) => {
      setDownloadStatus((prev) => ({ ...prev, [track.title]: 'downloading' }))
      try {
        const res = await downloadTrack(track, audioFormat, searchMode)
        if (res.ok && res.status === 'downloaded') {
          setDownloadStatus((prev) => ({ ...prev, [track.title]: 'done' }))
          void refreshFiles()
        } else if (res.status === 'needs_pick' && res.candidates) {
          setDownloadStatus((prev) => ({ ...prev, [track.title]: 'needs_pick' }))
          setCurrentCandidates(res.candidates)
          setCurrentCandidateTrack({ title: track.title, artist: track.artist })
          setCandidatePickerOpen(true)
        } else {
          setDownloadStatus((prev) => ({ ...prev, [track.title]: 'failed' }))
        }
      } catch {
        setDownloadStatus((prev) => ({ ...prev, [track.title]: 'failed' }))
      }
    },
    [downloadTrack, audioFormat, searchMode, refreshFiles]
  )

  // Download All Tracks
  const handleDownloadAll = useCallback(async () => {
    if (tracks.length === 0) return
    try {
      await downloadAll(tracks, audioFormat, searchMode)
      void refreshFiles()
    } catch (e: any) {
      toast({
        title: 'Batch Download Error',
        description: e.message,
        variant: 'destructive',
      })
    }
  }, [tracks, downloadAll, audioFormat, searchMode, refreshFiles, toast])

  // Pick Candidate
  const handlePickCandidate = useCallback(
    async (candidate: TrackCandidate) => {
      if (!currentCandidateTrack) return
      setDownloadingCandidateUrl(candidate.url)
      try {
        const res = await downloadTrack(
          {
            title: currentCandidateTrack.title,
            artist: currentCandidateTrack.artist,
            duration_ms: candidate.duration * 1000,
            cover_url: null,
            spotify_url: candidate.url,
            track_id: null,
          },
          audioFormat,
          searchMode,
          { candidateUrl: candidate.url }
        )
        if (res.ok) {
          setDownloadStatus((prev) => ({ ...prev, [currentCandidateTrack.title]: 'done' }))
          setCandidatePickerOpen(false)
          void refreshFiles()
        }
      } catch (e: any) {
        toast({ title: 'Candidate Download Failed', description: e.message, variant: 'destructive' })
      } finally {
        setDownloadingCandidateUrl(null)
      }
    },
    [currentCandidateTrack, downloadTrack, audioFormat, searchMode, refreshFiles, toast]
  )

  // File & Zip Actions
  const handleDeleteFile = useCallback(
    async (name: string) => {
      try {
        const res = await fetch(`/api/spotify/delete?name=${encodeURIComponent(name)}`, {
          method: 'DELETE',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (res.ok) {
          void refreshFiles()
          toast({ title: 'File Deleted', description: name })
        }
      } catch (e: any) {
        toast({ title: 'Delete Error', description: e.message, variant: 'destructive' })
      }
    },
    [token, refreshFiles, toast]
  )

  const handleDeleteZip = useCallback(
    async (name: string) => {
      try {
        const res = await fetch(`/api/spotify/delete-zip?name=${encodeURIComponent(name)}`, {
          method: 'DELETE',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (res.ok) {
          void refreshFiles()
          toast({ title: 'ZIP Deleted', description: name })
        }
      } catch (e: any) {
        toast({ title: 'Delete Error', description: e.message, variant: 'destructive' })
      }
    },
    [token, refreshFiles, toast]
  )

  const handleCreateZip = useCallback(async () => {
    try {
      const res = await fetch('/api/spotify/create-zip', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) {
        void refreshFiles()
        toast({ title: 'ZIP Archive Created' })
      }
    } catch (e: any) {
      toast({ title: 'ZIP Error', description: e.message, variant: 'destructive' })
    }
  }, [token, refreshFiles, toast])

  // Save Cookies
  const handleSaveCookies = useCallback(async () => {
    if (!cookiesContent.trim()) return
    setSavingCookies(true)
    try {
      const res = await saveCookies(cookiesContent)
      if (res.ok) {
        setCookiesDialogOpen(false)
        setCookiesContent('')
        toast({ title: 'Cookies Saved' })
      } else {
        toast({ title: 'Cookies Error', description: res.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Cookies Error', description: e.message, variant: 'destructive' })
    } finally {
      setSavingCookies(false)
    }
  }, [cookiesContent, saveCookies, toast])

  // Clear History
  const handleClearHistory = useCallback(async () => {
    setClearing(true)
    try {
      const res = await clearHistory({ deleteCookies: clearDialogIncludeCookies })
      if (res.ok) {
        setClearDialogOpen(false)
        void refreshFiles()
        toast({ title: 'History Cleared' })
      }
    } catch (e: any) {
      toast({ title: 'Clear Error', description: e.message, variant: 'destructive' })
    } finally {
      setClearing(false)
    }
  }, [clearHistory, clearDialogIncludeCookies, refreshFiles, toast])

  // Audio Playback Handler
  const handlePlayPreview = useCallback((track: Track) => {
    const filename = downloadedFilesMap[track.title] || `${track.artist} - ${track.title}.mp3`
    const audioUrl = `/api/spotify/file?name=${encodeURIComponent(filename)}`

    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl)
    } else {
      audioRef.current.src = audioUrl
    }

    audioRef.current.play()
    setPreviewTrackTitle(track.title)
    setIsPlaying(true)

    audioRef.current.ontimeupdate = () => {
      setCurrentTime(audioRef.current?.currentTime || 0)
    }
    audioRef.current.onloadedmetadata = () => {
      setDuration(audioRef.current?.duration || 0)
    }
    audioRef.current.onended = () => {
      setIsPlaying(false)
    }
  }, [downloadedFilesMap])

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8 text-foreground transition-colors pb-24">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header Bar Component */}
        <HeaderBar
          url={url}
          setUrl={setUrl}
          searchMode={searchMode}
          setSearchMode={setSearchMode}
          onFetch={handleFetch}
          isFetching={isFetching}
          isDownloading={isDownloading}
          onStop={stop}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenAdminSettings={() => setAdminSettingsOpen(true)}
          isAdmin={user?.isAdmin}
          username={user?.username}
          onLogout={logout}
        />

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Track List (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col h-[480px] sm:h-[520px] lg:h-[560px] min-h-0">
            <TrackList
              tracks={tracks}
              downloadStatus={downloadStatus}
              downloadedFilesMap={downloadedFilesMap}
              onDownloadSingle={handleDownloadSingle}
              onPickCandidate={(track) => {
                setCurrentCandidateTrack({ title: track.title, artist: track.artist })
                setCandidatePickerOpen(true)
              }}
              onDownloadAll={handleDownloadAll}
              isDownloading={isDownloading}
              searchMode={searchMode}
              onPlayPreview={handlePlayPreview}
            />
          </div>

          {/* Right Column: Execution Log (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col h-[480px] sm:h-[520px] lg:h-[560px] min-h-0">
            <LogPanel logs={logs} onClear={clearLogs} />
          </div>
        </div>

        {/* Download History & Zip Archives Section */}
        <DownloadHistoryPanel
          files={files}
          zips={zips}
          onDeleteFile={handleDeleteFile}
          onDeleteZip={handleDeleteZip}
          onCreateZip={handleCreateZip}
          isCreatingZip={false}
        />
      </div>

      {/* Audio Player Bar Component */}
      <PlayerBar
        currentTrackTitle={previewTrackTitle}
        isPlaying={isPlaying}
        onTogglePlay={() => {
          if (!audioRef.current) return
          if (isPlaying) {
            audioRef.current.pause()
            setIsPlaying(false)
          } else {
            audioRef.current.play()
            setIsPlaying(true)
          }
        }}
        currentTime={currentTime}
        duration={duration}
        onSeek={(val) => {
          if (audioRef.current) {
            audioRef.current.currentTime = val
            setCurrentTime(val)
          }
        }}
        volume={volume}
        onVolumeChange={(val) => {
          setVolume(val)
          if (audioRef.current) audioRef.current.volume = val
        }}
        isMuted={isMuted}
        onToggleMute={() => {
          setIsMuted(!isMuted)
          if (audioRef.current) audioRef.current.muted = !isMuted
        }}
        onClose={() => {
          if (audioRef.current) audioRef.current.pause()
          setPreviewTrackTitle(null)
          setIsPlaying(false)
        }}
      />

      {/* Candidate Picker Dialog Modal */}
      <CandidatePickerDialog
        open={candidatePickerOpen}
        onOpenChange={setCandidatePickerOpen}
        candidates={currentCandidates}
        trackTitle={currentCandidateTrack?.title || ''}
        trackArtist={currentCandidateTrack?.artist || ''}
        onPick={handlePickCandidate}
        downloadingUrl={downloadingCandidateUrl}
      />

      {/* Settings Dialog Modal */}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      {/* Admin Settings Dialog Modal */}
      {user?.isAdmin && (
        <AdminSettingsDialog open={adminSettingsOpen} onOpenChange={setAdminSettingsOpen} />
      )}

      {/* YouTube Cookies Dialog Modal */}
      <Dialog open={cookiesDialogOpen} onOpenChange={setCookiesDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>YouTube Cookies Required</DialogTitle>
            <DialogDescription>
              YouTube requires a cookies.txt file to complete downloads. Paste your Netscape-formatted cookies below.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={8}
            placeholder="# Netscape HTTP Cookie File..."
            value={cookiesContent}
            onChange={(e) => setCookiesContent(e.target.value)}
            className="font-mono text-xs"
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCookiesDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCookies} disabled={savingCookies}>
              {savingCookies ? 'Saving...' : 'Save Cookies'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
