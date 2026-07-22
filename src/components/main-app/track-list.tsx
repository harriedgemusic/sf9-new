'use client'

import { useSettings } from '@/components/settings-provider'
import type { Track, SearchMode } from '@/lib/spotify-types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Download, Sparkles, Music, Play, CheckCircle, AlertCircle, Clock } from 'lucide-react'

interface TrackListProps {
  tracks: Track[]
  downloadStatus: Record<string, 'downloading' | 'done' | 'failed' | 'needs_pick'>
  downloadedFilesMap: Record<string, string>
  onDownloadSingle: (track: Track) => void
  onPickCandidate: (track: Track) => void
  onDownloadAll: () => void
  isDownloading: boolean
  searchMode: SearchMode
  onPlayPreview?: (track: Track) => void
}

function formatDuration(ms: number): string {
  if (!ms) return '0:00'
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
}

export function TrackList({
  tracks,
  downloadStatus,
  downloadedFilesMap,
  onDownloadSingle,
  onPickCandidate,
  onDownloadAll,
  isDownloading,
  searchMode,
  onPlayPreview,
}: TrackListProps) {
  const { t } = useSettings()

  if (tracks.length === 0) {
    return (
      <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-card/50 p-6 text-center shadow-xs">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
          <Music className="h-6 w-6" />
        </div>
        <h3 className="text-base font-semibold text-foreground">
          {t.listEmpty || 'No tracks loaded'}
        </h3>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          {t.enterUrlPrompt || 'Paste a Spotify playlist, album, or track URL above to search and download extended mixes.'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-border/60 bg-card text-card-foreground shadow-xs">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <Music className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">
            {t.tracks || 'Found Tracks'}
          </h2>
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
            {tracks.length}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={onDownloadAll}
            disabled={isDownloading}
            className="gap-1.5 text-xs font-medium shadow-xs"
          >
            <Download className="h-3.5 w-3.5" />
            {t.downloadAll || 'Download All'}
          </Button>
        </div>
      </div>

      {/* Track Cards List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {tracks.map((track, idx) => {
          const status = downloadStatus[track.title]
          const isDone = status === 'done' || !!downloadedFilesMap[track.title]
          const isDownloadingThis = status === 'downloading'
          const isNeedsPick = status === 'needs_pick'
          const isFailed = status === 'failed'

          return (
            <div
              key={idx}
              className={`flex items-center justify-between gap-3 rounded-lg border p-3 transition-all ${
                isDone
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : isNeedsPick
                  ? 'border-amber-500/40 bg-amber-500/5'
                  : isFailed
                  ? 'border-destructive/30 bg-destructive/5'
                  : 'border-border/60 hover:border-border bg-background/50'
              }`}
            >
              {/* Cover & Info */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {track.cover_url ? (
                  <img
                    src={track.cover_url}
                    alt={track.title}
                    className="h-11 w-11 shrink-0 rounded-md object-cover shadow-xs"
                  />
                ) : (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Music className="h-5 w-5" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="truncate text-xs font-semibold text-foreground">
                      {track.title}
                    </h4>
                    {searchMode === 'extended' && (
                      <Badge variant="outline" className="h-4 border-primary/30 text-[9px] text-primary px-1">
                        <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                        Ext
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground mt-0.5">
                    {track.artist} {track.album ? `• ${track.album}` : ''}
                  </p>
                </div>
              </div>

              {/* Duration & Action Status */}
              <div className="flex items-center gap-3 shrink-0">
                <span className="hidden sm:flex items-center gap-1 text-[11px] font-mono text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatDuration(track.duration_ms)}
                </span>

                {isDone ? (
                  <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 gap-1 text-[11px] px-2 py-0.5">
                    <CheckCircle className="h-3 w-3" />
                    {t.downloaded || 'Ready'}
                  </Badge>
                ) : isNeedsPick ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPickCandidate(track)}
                    className="border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 text-xs h-8 gap-1"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Pick Extended
                  </Button>
                ) : isFailed ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDownloadSingle(track)}
                    className="border-destructive/40 text-destructive hover:bg-destructive/10 text-xs h-8 gap-1"
                  >
                    <AlertCircle className="h-3.5 w-3.5" />
                    {t.retry || 'Retry'}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDownloadSingle(track)}
                    disabled={isDownloadingThis || isDownloading}
                    className="text-xs h-8 gap-1.5"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {isDownloadingThis ? (t.downloading || 'Downloading...') : (t.download || 'Download')}
                  </Button>
                )}

                {onPlayPreview && downloadedFilesMap[track.title] && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => onPlayPreview(track)}
                    title="Play audio preview"
                  >
                    <Play className="h-3.5 w-3.5 text-primary" />
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
