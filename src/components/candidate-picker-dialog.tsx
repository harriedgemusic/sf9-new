'use client'

/**
 * CandidatePickerDialog — modal window that appears when:
 *   1) Extended mix search couldn't find a version longer than max duration.
 *   2) User enters a direct song search query (non-Spotify URL).
 *
 * Displays up to 10 matching candidates with platform badges, clean truncated titles,
 * duration, and download action buttons.
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
import { useSettings } from '@/components/settings-provider'
import type { TrackCandidate } from '@/lib/spotify-types'
import { Music, Youtube, Loader2, Download, Search, Clock, Sparkles } from 'lucide-react'

interface CandidatePickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidates: TrackCandidate[]
  trackTitle: string
  trackArtist: string
  onPick: (candidate: TrackCandidate) => void
  downloadingUrl: string | null  // URL currently being downloaded
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
      <DialogContent className="sm:max-w-xl md:max-w-2xl w-[92vw] sm:w-full overflow-hidden p-5 sm:p-6 bg-neutral-950/95 backdrop-blur-xl border border-neutral-800/80 shadow-2xl rounded-2xl text-neutral-100">
        <DialogHeader className="gap-1.5 text-left">
          <DialogTitle className="flex items-center gap-2.5 text-base sm:text-lg font-semibold tracking-tight text-neutral-100">
            <div className="size-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              {isDirectSearch ? <Search className="size-4" /> : <Sparkles className="size-4" />}
            </div>
            <span>{isDirectSearch ? (t.searchPickerTitle || 'Выберите вариант для скачивания') : t.pickerTitle}</span>
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-neutral-400">
            {isDirectSearch ? (t.searchPickerDescription || 'Найдены следующие варианты по вашему запросу:') : t.pickerDescription}
          </DialogDescription>
        </DialogHeader>

        {/* Query / Track subtitle badge */}
        <div className="flex items-center gap-2 p-2.5 px-3 rounded-xl bg-neutral-900/80 border border-neutral-800/80 text-xs text-neutral-300 min-w-0 w-full overflow-hidden">
          <span className="text-neutral-400 font-medium shrink-0">
            {isDirectSearch ? 'Запрос:' : 'Трек:'}
          </span>
          <span className="font-semibold text-neutral-100 truncate min-w-0 flex-1" title={trackArtist ? `${trackArtist} — ${trackTitle}` : trackTitle}>
            {trackArtist ? `${trackArtist} — ${trackTitle}` : trackTitle}
          </span>
        </div>

        {/* Candidate list */}
        {sorted.length === 0 ? (
          <div className="py-10 text-center text-sm text-neutral-400">
            {t.pickerEmpty}
          </div>
        ) : (
          <div className="max-h-[55vh] overflow-y-auto overflow-x-hidden pr-1.5 space-y-2.5 w-full">
            {sorted.map((c, idx) => {
              const isDownloading = downloadingUrl === c.url
              return (
                <div
                  key={`${c.url}-${idx}`}
                  className={`group flex items-center justify-between gap-3 p-3 rounded-xl border transition-all duration-200 w-full box-border overflow-hidden ${
                    isDownloading
                      ? 'border-emerald-500/80 bg-emerald-500/10'
                      : 'border-neutral-800/80 bg-neutral-900/50 hover:bg-neutral-800/70 hover:border-neutral-700/80'
                  }`}
                >
                  {/* Platform icon */}
                  <div className={`size-9 shrink-0 rounded-lg flex items-center justify-center border ${
                    c.platform === 'YouTube'
                      ? 'bg-red-500/10 border-red-500/20 text-red-400'
                      : 'bg-orange-500/10 border-orange-500/20 text-orange-400'
                  }`}>
                    {c.platform === 'YouTube' ? <Youtube className="size-4" /> : <Music className="size-4" />}
                  </div>

                  {/* Track Info (Title + Badges) */}
                  <div className="flex-1 min-w-0 overflow-hidden pr-1">
                    <p className="text-xs sm:text-sm font-medium text-neutral-200 group-hover:text-white truncate block max-w-full" title={c.title}>
                      {c.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-neutral-400 flex-wrap">
                      <Badge variant="outline" className="text-[10px] py-0.5 px-2 bg-neutral-800/80 border-neutral-700/60 text-neutral-300 font-semibold uppercase tracking-wider shrink-0">
                        {c.platform}
                      </Badge>
                      <span className="font-mono text-[11px] sm:text-xs text-neutral-300 bg-neutral-800/50 px-2 py-0.5 rounded-md border border-neutral-800 flex items-center gap-1 shrink-0">
                        <Clock className="size-3 text-neutral-400" />
                        {formatDuration(c.duration)}
                      </span>
                      {!isDirectSearch && c.similar && (
                        <Badge variant="outline" className="text-[9px] py-0.5 px-2 border-emerald-500/40 text-emerald-400 bg-emerald-500/10 shrink-0">
                          {t.pickerSimilar}
                        </Badge>
                      )}
                      {!isDirectSearch && c.matches_filter && (
                        <Badge variant="outline" className="text-[9px] py-0.5 px-2 border-blue-500/40 text-blue-400 bg-blue-500/10 shrink-0">
                          {t.pickerMatches}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Action Button */}
                  <Button
                    size="sm"
                    className={`h-9 px-3.5 text-xs font-medium gap-1.5 shrink-0 rounded-lg transition-all active:scale-95 whitespace-nowrap ${
                      isDownloading
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm hover:shadow-emerald-950/40'
                    }`}
                    onClick={() => onPick(c)}
                    disabled={isDownloading}
                  >
                    {isDownloading ? (
                      <><Loader2 className="size-3.5 animate-spin" /> {t.downloading}</>
                    ) : (
                      <><Download className="size-3.5" /> {t.pickerDownload}</>
                    )}
                  </Button>
                </div>
              )
            })}
          </div>
        )}

        <DialogFooter className="mt-2">
          <Button variant="outline" className="border-neutral-800 hover:bg-neutral-900 text-neutral-300 hover:text-white text-xs h-9 px-4 rounded-xl" onClick={() => onOpenChange(false)}>
            {t.pickerCancel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
