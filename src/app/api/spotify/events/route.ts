/**
 * GET /api/spotify/events
 *
 * Server-Sent Events (SSE) stream of all jobs-related events:
 *   - "log"              : a new log entry
 *   - "summary"          : updated JobSummary
 *   - "download-done"    : a single track download finished
 *   - "batch-done"       : a batch download finished (includes zip metadata)
 *   - "logs-cleared"     : the log buffer was cleared
 *   - "history-cleared"  : all files + logs + summary were wiped
 *   - "zip-created"      : a new ZIP archive was created after a batch
 *   - "cookies-required" : YouTube returned a "not a bot" error; cookies needed
 *   - "cookies-updated"  : the cookies.txt file was added / removed
 *
 * The stream stays open as long as the client keeps the connection. On
 * connect, we immediately send the log history, current summary, cookies
 * availability and cookies-required flag so the UI can render the existing
 * state without polling.
 */

import { NextRequest } from 'next/server'
import { getJobs } from '@/lib/jobs'
import type { LogEntry, JobSummary } from '@/lib/jobs'
import { getUserFromRequest } from '@/lib/auth/request'
import { verifyToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  // SSE doesn't support custom headers, so accept token via query param as fallback
  let user = await getUserFromRequest(req)
  if (!user) {
    const token = req.nextUrl.searchParams.get('token')
    if (token) {
      user = await verifyToken(token)
    }
  }
  if (!user) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const jobs = getJobs(user.userId)

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
        try {
          controller.enqueue(encoder.encode(payload))
        } catch {
          // controller already closed
        }
      }

      // Initial state — sent immediately on connect
      send('log-history', jobs.getLogs())
      send('summary', jobs.getSummary())
      send('cookies-updated', { available: jobs.hasCookies() })
      send('cookies-required', { required: jobs.getCookiesRequested() })
      send('active-status', { isDownloading: jobs.hasActiveJobs() })

      const onLog = (entry: LogEntry) => send('log', entry)
      const onSummary = (s: JobSummary) => send('summary', s)
      const onDownloadDone = (p: any) => send('download-done', p)
      const onBatchDone = (p: any) => send('batch-done', p)
      const onLogsCleared = () => send('logs-cleared', null)
      const onHistoryCleared = (p: any) => send('history-cleared', p)
      const onZipCreated = (p: any) => send('zip-created', p)
      const onCookiesRequired = (p: any) => send('cookies-required', p)
      const onCookiesUpdated = (p: any) => send('cookies-updated', p)
      const onStopped = (p: any) => send('stopped', p)
      const onActiveStatus = (p: any) => send('active-status', p)

      jobs.emitter.on('log', onLog)
      jobs.emitter.on('summary', onSummary)
      jobs.emitter.on('download-done', onDownloadDone)
      jobs.emitter.on('batch-done', onBatchDone)
      jobs.emitter.on('logs-cleared', onLogsCleared)
      jobs.emitter.on('history-cleared', onHistoryCleared)
      jobs.emitter.on('zip-created', onZipCreated)
      jobs.emitter.on('cookies-required', onCookiesRequired)
      jobs.emitter.on('cookies-updated', onCookiesUpdated)
      jobs.emitter.on('stopped', onStopped)
      jobs.emitter.on('active-status', onActiveStatus)

      // Heartbeat every 25s to keep the connection alive through proxies
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'))
        } catch {
          // ignore
        }
      }, 25000)

      // Clean up on abort / close
      const cleanup = () => {
        clearInterval(heartbeat)
        jobs.emitter.off('log', onLog)
        jobs.emitter.off('summary', onSummary)
        jobs.emitter.off('download-done', onDownloadDone)
        jobs.emitter.off('batch-done', onBatchDone)
        jobs.emitter.off('logs-cleared', onLogsCleared)
        jobs.emitter.off('history-cleared', onHistoryCleared)
        jobs.emitter.off('zip-created', onZipCreated)
        jobs.emitter.off('cookies-required', onCookiesRequired)
        jobs.emitter.off('cookies-updated', onCookiesUpdated)
        jobs.emitter.off('stopped', onStopped)
        jobs.emitter.off('active-status', onActiveStatus)
        try { controller.close() } catch { /* already closed */ }
      }

      req.signal.addEventListener('abort', cleanup)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
