'use client'

import { useSettings } from '@/components/settings-provider'
import { Button } from '@/components/ui/button'
import { Play, Pause, Volume2, VolumeX, Music, X } from 'lucide-react'

interface PlayerBarProps {
  currentTrackTitle: string | null
  isPlaying: boolean
  onTogglePlay: () => void
  currentTime: number
  duration: number
  onSeek: (seconds: number) => void
  volume: number
  onVolumeChange: (val: number) => void
  isMuted: boolean
  onToggleMute: () => void
  onClose: () => void
}

function formatTime(secs: number): string {
  if (isNaN(secs) || secs < 0) return '0:00'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

export function PlayerBar({
  currentTrackTitle,
  isPlaying,
  onTogglePlay,
  currentTime,
  duration,
  onSeek,
  volume,
  onVolumeChange,
  isMuted,
  onToggleMute,
  onClose,
}: PlayerBarProps) {
  const { t } = useSettings()

  if (!currentTrackTitle) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/80 bg-background/95 p-3 backdrop-blur-md shadow-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        {/* Track Title Info */}
        <div className="flex items-center gap-3 min-w-0 max-w-[240px] sm:max-w-xs">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Music className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-foreground">
              {currentTrackTitle}
            </p>
            <p className="text-[10px] text-muted-foreground">
              Playing track preview
            </p>
          </div>
        </div>

        {/* Playback Controls & Timeline */}
        <div className="flex flex-1 max-w-xl flex-col items-center gap-1.5">
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="icon-sm"
              onClick={onTogglePlay}
              className="h-8 w-8 rounded-full shadow-xs"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
            </Button>
          </div>

          <div className="flex w-full items-center gap-2 text-[10px] font-mono text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={1}
              value={currentTime}
              onChange={(e) => onSeek(Number(e.target.value))}
              className="flex-1 h-1.5 accent-primary bg-muted rounded-lg appearance-none cursor-pointer"
            />
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Volume & Close Control */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2 w-28">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onToggleMute}
              className="text-muted-foreground hover:text-foreground"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="h-4 w-4 text-destructive" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              className="flex-1 h-1.5 accent-primary bg-muted rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
