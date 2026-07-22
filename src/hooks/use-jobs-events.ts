'use client'

/**
 * useJobsEvents
 *
 * React hook that connects to /api/spotify/events (SSE) with the auth
 * token as a query parameter, and exposes all fetch helpers with the
 * Authorization header set automatically.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import type {
  Track,
  LogEntry,
  JobSummary,
  DownloadResult,
  FetchResult,
  ZipArchive,
} from '@/lib/spotify-types'

interface DownloadProgress {
  track: Track
  result: DownloadResult
}

interface HistoryClearedPayload {
  deletedFiles: number
  deletedArchives: number
}

export function useJobsEvents(token: string | null) {
  const [isConnected, setIsConnected] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [summary, setSummary] = useState<JobSummary>({ downloaded: 0, skipped: 0, failed: 0, total: 0 })
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null)
  const [batchDoneAt, setBatchDoneAt] = useState<number | null>(null)
  const [historyClearedAt, setHistoryClearedAt] = useState<number | null>(null)
  const [lastZip, setLastZip] = useState<ZipArchive | null>(null)
  const [cookiesRequired, setCookiesRequired] = useState(false)
  const [cookiesAvailable, setCookiesAvailable] = useState(false)
  const [stoppedAt, setStoppedAt] = useState<number | null>(null)
  const [isServerDownloading, setIsServerDownloading] = useState(false)
  const sourceRef = useRef<EventSource | null>(null)

  // Build auth headers used by every fetch action
  const authHeaders = useCallback((): Record<string, string> => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token])

  useEffect(() => {
    if (!token) return

    const src = new EventSource(`/api/spotify/events?token=${encodeURIComponent(token)}`)
    sourceRef.current = src

    const onOpen = () => setIsConnected(true)
    const onError = () => setIsConnected(false)
    const onLogHistory = (e: MessageEvent) => {
      try {
        const history = JSON.parse(e.data) as LogEntry[]
        setLogs(history)
      } catch {}
    }
    const onLog = (e: MessageEvent) => {
      try {
        const entry = JSON.parse(e.data) as LogEntry
        setLogs((prev) => {
          const next = [...prev, entry]
          if (next.length > 500) next.splice(0, next.length - 500)
          return next
        })
      } catch {}
    }
    const onSummary = (e: MessageEvent) => {
      try {
        setSummary(JSON.parse(e.data) as JobSummary)
      } catch {}
    }
    const onDownloadDone = (e: MessageEvent) => {
      try {
        const p = JSON.parse(e.data) as DownloadProgress
        setDownloadProgress(p)
      } catch {}
    }
    const onBatchDone = (e: MessageEvent) => {
      try {
        const p = JSON.parse(e.data)
        if (p?.zip) {
          setLastZip(p.zip as ZipArchive)
        }
      } catch {}
      setBatchDoneAt(Date.now())
      setIsServerDownloading(false)
    }
    const onLogsCleared = () => setLogs([])
    const onHistoryCleared = (e: MessageEvent) => {
      try {
        const p = JSON.parse(e.data) as HistoryClearedPayload
        void p
      } catch {}
      setHistoryClearedAt(Date.now())
      setLastZip(null)
      setIsServerDownloading(false)
    }
    const onZipCreated = (e: MessageEvent) => {
      try {
        const p = JSON.parse(e.data) as ZipArchive
        setLastZip(p)
      } catch {}
    }
    const onCookiesRequired = (e: MessageEvent) => {
      try {
        const p = JSON.parse(e.data)
        setCookiesRequired(Boolean(p?.required))
      } catch {}
    }
    const onCookiesUpdated = (e: MessageEvent) => {
      try {
        const p = JSON.parse(e.data)
        setCookiesAvailable(Boolean(p?.available))
        if (p?.available) {
          setCookiesRequired(false)
        }
      } catch {}
    }
    const onStopped = () => {
      setStoppedAt(Date.now())
      setIsServerDownloading(false)
    }
    const onActiveStatus = (e: MessageEvent) => {
      try {
        const p = JSON.parse(e.data)
        setIsServerDownloading(Boolean(p?.isDownloading))
      } catch {}
    }

    src.addEventListener('open', onOpen as any)
    src.addEventListener('error', onError as any)
    src.addEventListener('log-history', onLogHistory as any)
    src.addEventListener('log', onLog as any)
    src.addEventListener('summary', onSummary as any)
    src.addEventListener('download-done', onDownloadDone as any)
    src.addEventListener('batch-done', onBatchDone as any)
    src.addEventListener('logs-cleared', onLogsCleared as any)
    src.addEventListener('history-cleared', onHistoryCleared as any)
    src.addEventListener('zip-created', onZipCreated as any)
    src.addEventListener('cookies-required', onCookiesRequired as any)
    src.addEventListener('cookies-updated', onCookiesUpdated as any)
    src.addEventListener('stopped', onStopped as any)
    src.addEventListener('active-status', onActiveStatus as any)

    return () => {
      src.removeEventListener('open', onOpen as any)
      src.removeEventListener('error', onError as any)
      src.removeEventListener('log-history', onLogHistory as any)
      src.removeEventListener('log', onLog as any)
      src.removeEventListener('summary', onSummary as any)
      src.removeEventListener('download-done', onDownloadDone as any)
      src.removeEventListener('batch-done', onBatchDone as any)
      src.removeEventListener('logs-cleared', onLogsCleared as any)
      src.removeEventListener('history-cleared', onHistoryCleared as any)
      src.removeEventListener('zip-created', onZipCreated as any)
      src.removeEventListener('cookies-required', onCookiesRequired as any)
      src.removeEventListener('cookies-updated', onCookiesUpdated as any)
      src.removeEventListener('stopped', onStopped as any)
      src.removeEventListener('active-status', onActiveStatus as any)
      src.close()
    }
  }, [token])

  const fetchTracks = useCallback(async (url: string): Promise<FetchResult> => {
    const r = await fetch('/api/spotify/fetch', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ url }),
    })
    return (await r.json()) as FetchResult
  }, [authHeaders])

  const downloadTrack = useCallback(
    async (
      track: Track,
      audioFormat: 'mp3-320' | 'wav-16-44100' = 'mp3-320',
      searchMode: 'extended' | 'simple' = 'extended',
      searchParams?: Record<string, unknown>,
    ): Promise<DownloadResult> => {
      const r = await fetch('/api/spotify/download', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ track, audioFormat, searchMode, searchParams }),
      })
      return (await r.json()) as DownloadResult
    },
    [authHeaders],
  )

  const downloadAll = useCallback(
    async (
      tracks: Track[],
      audioFormat: 'mp3-320' | 'wav-16-44100' = 'mp3-320',
      searchMode: 'extended' | 'simple' = 'extended',
      searchParams?: Record<string, unknown>,
    ): Promise<{ ok: boolean; count: number }> => {
      const r = await fetch('/api/spotify/download-all', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ tracks, audioFormat, searchMode, searchParams }),
      })
      return (await r.json())
    },
    [authHeaders],
  )

  const clearLogs = useCallback(async () => {
    await fetch('/api/spotify/clear-logs', { method: 'POST', headers: authHeaders() })
  }, [authHeaders])

  const resetSummary = useCallback(async () => {
    await fetch('/api/spotify/reset-summary', { method: 'POST', headers: authHeaders() })
  }, [authHeaders])

  const clearHistory = useCallback(async (opts: { deleteCookies?: boolean } = {}): Promise<{
    ok: boolean
    deletedFiles?: number
    deletedArchives?: number
  }> => {
    const r = await fetch('/api/spotify/clear-history', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ deleteCookies: opts.deleteCookies === true }),
    })
    return (await r.json())
  }, [authHeaders])

  const saveCookies = useCallback(async (content: string): Promise<{ ok: boolean; error?: string }> => {
    const r = await fetch('/api/spotify/cookies', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ content }),
    })
    return (await r.json())
  }, [authHeaders])

  const deleteCookies = useCallback(async (): Promise<{ ok: boolean }> => {
    const r = await fetch('/api/spotify/cookies', { method: 'DELETE', headers: authHeaders() })
    return (await r.json())
  }, [authHeaders])

  const stop = useCallback(async (): Promise<{ ok: boolean }> => {
    const r = await fetch('/api/spotify/stop', { method: 'POST', headers: authHeaders() })
    return (await r.json())
  }, [authHeaders])

  const downloadByUrl = useCallback(async (
    url: string,
    artist: string,
    title: string,
    audioFormat: 'mp3-320' | 'wav-16-44100' = 'mp3-320',
  ): Promise<DownloadResult> => {
    const r = await fetch('/api/spotify/download-url', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ url, artist, title, audioFormat }),
    })
    return (await r.json()) as DownloadResult
  }, [authHeaders])

  return {
    // SSE state
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
    // Actions
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
  }
}