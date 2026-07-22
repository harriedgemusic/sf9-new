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
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
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

  // Sort: similar first, then by duration descending
  const sorted = [...candidates].sort((a, b) => {
    if (a.similar !== b.similar) return a.similar ? -1 : 1
    return b.duration - a.duration
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="size-5 text-amber-500" />
            {t.pickerTitle}
          </DialogTitle>
          <DialogDescription>
            {t.pickerDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="text-sm text-muted-foreground mb-2">
          <span className="font-medium text-foreground">{trackArtist}</span> — {trackTitle}
        </div>

        {sorted.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {t.pickerEmpty}
          </div>
        ) : (
          <ScrollArea className="max-h-[50vh] pr-3">
            <ul className="space-y-2">
              {sorted.map((c, idx) => {
                const isDownloading = downloadingUrl === c.url
                return (
                  <li
                    key={`${c.url}-${idx}`}
                    className={`flex items-center gap-3 p-3 rounded-md border transition-colors ${
                      isDownloading
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-border hover:bg-accent/40'
                    }`}
                  >
                    {/* Platform icon */}
                    <div className={`size-9 shrink-0 rounded-md flex items-center justify-center ${
                      c.platform === 'YouTube'
                        ? 'bg-red-500/10 text-red-500'
                        : 'bg-orange-500/10 text-orange-500'
                    }`}>
                      {c.platform === 'YouTube' ? <Youtube className="size-4" /> : <Music className="size-4" />}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" title={c.title}>{c.title}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                        <Badge variant="outline" className="text-[10px] py-0 h-4">
                          {c.platform}
                        </Badge>
                        <span className="font-mono">{formatDuration(c.duration)}</span>
                        {c.similar && (
                          <Badge variant="outline" className="text-[9px] py-0 h-4 border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                            {t.pickerSimilar}
                          </Badge>
                        )}
                        {c.matches_filter && (
                          <Badge variant="outline" className="text-[9px] py-0 h-4 border-blue-500/40 text-blue-600 dark:text-blue-400">
                            {t.pickerMatches}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Action */}
                    <Button
                      size="sm"
                      variant={isDownloading ? 'default' : 'outline'}
                      className="h-8 gap-1 shrink-0"
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
