'use client'

import { useSettings } from '@/components/settings-provider'
import type { DownloadedFile, ZipArchive } from '@/lib/spotify-types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileAudio, Archive, Download, Trash2, HardDrive } from 'lucide-react'

interface DownloadHistoryPanelProps {
  files: DownloadedFile[]
  zips: ZipArchive[]
  onDeleteFile: (filename: string) => void
  onDeleteZip: (zipname: string) => void
  onCreateZip: () => void
  isCreatingZip: boolean
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function DownloadHistoryPanel({
  files,
  zips,
  onDeleteFile,
  onDeleteZip,
  onCreateZip,
  isCreatingZip,
}: DownloadHistoryPanelProps) {
  const { t } = useSettings()

  if (files.length === 0 && zips.length === 0) {
    return null
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card text-card-foreground p-4 shadow-xs space-y-4">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3">
        <div className="flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            {t.downloadHistory || 'Downloaded Files'}
          </h3>
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
            {t.mp3Count(files.length)}
          </Badge>
        </div>

        {files.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={onCreateZip}
            disabled={isCreatingZip}
            className="gap-1.5 text-xs font-medium"
          >
            <Archive className="h-3.5 w-3.5 text-primary" />
            {isCreatingZip ? 'Creating ZIP...' : 'Create ZIP Archive'}
          </Button>
        )}
      </div>

      {/* Zip Archives List (if any) */}
      {zips.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {t.lastArchive || 'ZIP Archives'}
          </h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {zips.map((zip) => (
              <div
                key={zip.name}
                className="flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 p-2.5"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Archive className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground">
                      {zip.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatBytes(zip.size)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <a
                    href={`/api/spotify/download-zip?name=${encodeURIComponent(zip.name)}`}
                    download
                  >
                    <Button variant="ghost" size="icon-xs" title={t.downloadZip || 'Download ZIP'}>
                      <Download className="h-3.5 w-3.5 text-primary" />
                    </Button>
                  </a>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => onDeleteZip(zip.name)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audio Files List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
            {files.map((file) => (
              <div
                key={file.name}
                className="flex items-center justify-between gap-3 rounded-md border border-border/50 bg-background/60 p-2 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <FileAudio className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate font-medium text-foreground">{file.name}</span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {formatBytes(file.size)}
                  </span>

                  <a
                    href={`/api/spotify/file?name=${encodeURIComponent(file.name)}`}
                    download
                  >
                    <Button variant="ghost" size="icon-xs" title="Download File">
                      <Download className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                    </Button>
                  </a>

                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => onDeleteFile(file.name)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
