'use client'

import { useState, useRef, useEffect } from 'react'
import { useSettings } from '@/components/settings-provider'
import type { LogEntry } from '@/lib/spotify-types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Trash2, Terminal, Info, AlertTriangle, AlertCircle } from 'lucide-react'

interface LogPanelProps {
  logs: LogEntry[]
  onClear: () => void
}

export function LogPanel({ logs, onClear }: LogPanelProps) {
  const { t } = useSettings()
  const [filterLevel, setFilterLevel] = useState<'all' | 'info' | 'warning' | 'error'>('all')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs])

  const filteredLogs = logs.filter((log) => {
    if (filterLevel === 'all') return true
    return log.level === filterLevel
  })

  return (
    <div className="flex h-full flex-col rounded-xl border border-border/60 bg-card text-card-foreground shadow-xs">
      {/* Log Header */}
      <div className="flex items-center justify-between border-b border-border/40 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">
            {t.eventLog || 'Execution Log'}
          </h2>
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
            {filteredLogs.length}
          </Badge>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Level Filter Buttons */}
          <div className="flex items-center rounded-md border border-input p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setFilterLevel('all')}
              className={`rounded px-1.5 py-0.5 font-medium transition-colors ${
                filterLevel === 'all'
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilterLevel('info')}
              className={`rounded px-1.5 py-0.5 font-medium transition-colors ${
                filterLevel === 'info'
                  ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Info
            </button>
            <button
              type="button"
              onClick={() => setFilterLevel('warning')}
              className={`rounded px-1.5 py-0.5 font-medium transition-colors ${
                filterLevel === 'warning'
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Warn
            </button>
            <button
              type="button"
              onClick={() => setFilterLevel('error')}
              className={`rounded px-1.5 py-0.5 font-medium transition-colors ${
                filterLevel === 'error'
                  ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Err
            </button>
          </div>

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClear}
            title={t.clearLog || 'Clear Logs'}
            className="text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Log Body */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-relaxed"
      >
        {filteredLogs.length === 0 ? (
          <div className="flex h-full min-h-[160px] items-center justify-center text-muted-foreground/60">
            {t.logEmpty || 'No log entries recorded'}
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredLogs.map((log, idx) => {
              const Icon =
                log.level === 'error'
                  ? AlertCircle
                  : log.level === 'warning'
                  ? AlertTriangle
                  : Info

              const colorClass =
                log.level === 'error'
                  ? 'text-destructive bg-destructive/10 border-destructive/20'
                  : log.level === 'warning'
                  ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20'
                  : 'text-muted-foreground bg-muted/30 border-border/30'

              return (
                <div
                  key={idx}
                  className={`flex items-start gap-2 rounded-md border px-2.5 py-1.5 transition-colors ${colorClass}`}
                >
                  <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-80" />
                  <span className="shrink-0 text-[10px] opacity-60 font-sans">
                    {log.ts}
                  </span>
                  <span className="break-all whitespace-pre-wrap">{log.message}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
