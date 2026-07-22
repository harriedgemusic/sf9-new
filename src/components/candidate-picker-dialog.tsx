'use client'

/**
 * CandidatePickerDialog — modal window that appears when the extended-mix
 * search couldn't find a version longer than the max duration.
 *
 * Shows all found candidates (sorted by relevance) with their:
 *   - platform badge (YouTube / SoundCloud)
 *   - title
 *   - duration
 *   - whether they match the similarity filter
 *
 * The user picks one and the parent component triggers a direct download
 * via /api/spotify/download-url.
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useSettings } from '@/components/settings-provider'
import type { TrackCandidate } from '@/lib/spotify-types'
import { Music, Youtube, Loader2, Check, AlertCircle } from 'lucide-react'

interface CandidatePickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidates: TrackCandidate[]
  trackTitle: string
  trackArtist: string
  onPick: (candidate: TrackCandidate) => void
  downloadingUrl: string | null  // URL currently being downloaded (shows spinner)
}

function formatDuration(seconds: number): string {
  if (!seconds) return '--:--'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function CandidatePickerDialog({
  open,
  onOpenChange,
  candidates,
  trackTitle,
  trackArtist,
  onPick,
  downloadingUrl,
}: CandidatePickerDialogProps) {
  const { t } = useSettings()

  const isDirectSearch = !trackArtist

  // Sort: similar first, then by duration descending
  const sorted = [...candidates].sort((a, b) => {
    if (a.similar !== b.similar) return a.similar ? -1 : 1
    return b.duration - a.duration
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-2xl w-full overflow-hidden p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="size-5 text-amber-500 shrink-0" />
            {isDirectSearch ? (t.searchPickerTitle || t.pickerTitle) : t.pickerTitle}
          </DialogTitle>
          <DialogDescription>
            {isDirectSearch ? (t.searchPickerDescription || t.pickerDescription) : t.pickerDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="text-sm text-muted-foreground mb-2 truncate">
          {trackArtist ? (
            <>
              <span className="font-medium text-foreground">{trackArtist}</span> — {trackTitle}
            </>
          ) : (
            <span className="font-medium text-foreground">{trackTitle}</span>
          )}
        </div>

        {sorted.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {t.pickerEmpty}
          </div>
        ) : (
          <ScrollArea className="max-h-[55vh] w-full pr-1 overflow-x-hidden">
            <ul className="space-y-2 w-full max-w-full overflow-hidden">
              {sorted.map((c, idx) => {
                const isDownloading = downloadingUrl === c.url
                return (
                  <li
                    key={`${c.url}-${idx}`}
                    className={`flex items-center justify-between gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-md border transition-colors w-full box-border overflow-hidden ${
                      isDownloading
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-border hover:bg-accent/40'
                    }`}
                  >
                    {/* Platform icon */}
                    <div className={`size-8 sm:size-9 shrink-0 rounded-md flex items-center justify-center ${
                      c.platform === 'YouTube'
                        ? 'bg-red-500/10 text-red-500'
                        : 'bg-orange-500/10 text-orange-500'
                    }`}>
                      {c.platform === 'YouTube' ? <Youtube className="size-4" /> : <Music className="size-4" />}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 pr-1 overflow-hidden">
                      <p className="text-xs sm:text-sm font-medium truncate" title={c.title}>{c.title}</p>
                      <div className="flex items-center gap-1.5 sm:gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                        <Badge variant="outline" className="text-[10px] py-0 h-4 shrink-0">
                          {c.platform}
                        </Badge>
                        <span className="font-mono text-[11px] sm:text-xs shrink-0">{formatDuration(c.duration)}</span>
                        {!isDirectSearch && c.similar && (
                          <Badge variant="outline" className="text-[9px] py-0 h-4 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 shrink-0">
                            {t.pickerSimilar}
                          </Badge>
                        )}
                        {!isDirectSearch && c.matches_filter && (
                          <Badge variant="outline" className="text-[9px] py-0 h-4 border-blue-500/40 text-blue-600 dark:text-blue-400 shrink-0">
                            {t.pickerMatches}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Action */}
                    <Button
                      size="sm"
                      variant={isDownloading ? 'default' : 'outline'}
                      className="h-8 text-xs px-2.5 sm:px-3 gap-1 shrink-0 whitespace-nowrap"
                      onClick={() => onPick(c)}
                      disabled={isDownloading}
                    >
                      {isDownloading ? (
                        <><Loader2 className="size-3.5 animate-spin" /> {t.downloading}</>
                      ) : (
                        <><Check className="size-3.5" /> {t.pickerDownload}</>
                      )}
                    </Button>
                  </li>
                )
              })}
            </ul>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.pickerCancel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
