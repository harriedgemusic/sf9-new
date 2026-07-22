/**
 * Process runner helper for spawning python scripts and handling stdio streams.
 */

import { spawn, spawnSync, ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { DEFAULT_PROCESS_TIMEOUT_MS } from './types'
import type { LogEntry } from './types'

const PROJECT_ROOT = /*turbopackIgnore: true*/ process.cwd()

/**
 * Automatically pick available python binary.
 */
export function pickPython(): string {
  for (const candidate of ['python3', 'python']) {
    try {
      const r = spawnSync(candidate, ['--version'], { stdio: 'pipe' })
      if (r.status === 0) return candidate
    } catch {
      // try next candidate
    }
  }
  return 'python3'
}

export const PYTHON_BIN = pickPython()

export interface ProcessRunResult {
  ok: boolean
  payload: any
  code: number
}

export interface ProcessRunOptions {
  scriptName: string
  args: string[]
  cookiesFile: string
  envExtra?: Record<string, string>
  /** Execution timeout in ms. Default: 180,000ms (3 minutes) */
  timeoutMs?: number
  onLog: (entry: LogEntry) => void
  onRegisterChild?: (childId: string, child: ChildProcess) => void
  onUnregisterChild?: (childId: string) => void
}

/**
 * Spawns a Python helper process and streams output via stdout/stderr JSON-lines.
 * Includes Layer 5 Timeout Controls to abort hanging processes safely.
 */
export function runPythonScript(options: ProcessRunOptions): Promise<ProcessRunResult> {
  const {
    scriptName,
    args,
    cookiesFile,
    envExtra = {},
    timeoutMs = DEFAULT_PROCESS_TIMEOUT_MS,
    onLog,
    onRegisterChild,
    onUnregisterChild,
  } = options

  return new Promise((resolvePromise) => {
    const cookiesExist = existsSync(cookiesFile)
    const env = {
      ...process.env,
      PATH: `${process.env.PATH}:/home/z/.local/bin`,
      YTDLP_COOKIES_FILE: cookiesExist ? cookiesFile : '',
      ...envExtra,
    }
    const scriptPath = join(PROJECT_ROOT, 'scripts', scriptName)
    const child = spawn(PYTHON_BIN, [scriptPath, ...args], {
      env,
      cwd: PROJECT_ROOT,
    })

    const childId = `child-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    if (onRegisterChild) {
      onRegisterChild(childId, child)
    }

    let isSettled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        if (isSettled) return
        isSettled = true

        onLog({
          level: 'error',
          message: `Process '${scriptName}' timed out after ${timeoutMs}ms — aborting process`,
          ts: new Date().toISOString().slice(11, 19),
        })

        try {
          child.kill('SIGTERM')
          setTimeout(() => {
            try { child.kill('SIGKILL') } catch { /* already dead */ }
          }, 1000)
        } catch { /* ignore */ }

        if (onUnregisterChild) onUnregisterChild(childId)

        resolvePromise({
          ok: false,
          payload: { ok: false, error: `Execution timed out after ${timeoutMs}ms` },
          code: -1,
        })
      }, timeoutMs)
    }

    let stdoutBuf = ''
    let stderrBuf = ''
    const finalPayloads: any[] = []

    const handleLine = (line: string) => {
      const trimmed = line.trim()
      if (!trimmed) return
      try {
        const obj = JSON.parse(trimmed)
        if (obj && typeof obj === 'object' && 'level' in obj && 'message' in obj) {
          onLog(obj as LogEntry)
          return
        }
        finalPayloads.push(obj)
      } catch {
        onLog({
          level: 'info',
          message: trimmed,
          ts: new Date().toISOString().slice(11, 19),
        })
      }
    }

    child.stdout.on('data', (chunk: Buffer) => {
      stdoutBuf += chunk.toString('utf8')
      let nl
      while ((nl = stdoutBuf.indexOf('\n')) !== -1) {
        const line = stdoutBuf.slice(0, nl)
        stdoutBuf = stdoutBuf.slice(nl + 1)
        handleLine(line)
      }
    })

    child.stderr.on('data', (chunk: Buffer) => {
      stderrBuf += chunk.toString('utf8')
      let nl
      while ((nl = stderrBuf.indexOf('\n')) !== -1) {
        const line = stderrBuf.slice(0, nl)
        stderrBuf = stderrBuf.slice(nl + 1)
        if (line.trim()) {
          onLog({
            level: 'error',
            message: `[python stderr] ${line.trim()}`,
            ts: new Date().toISOString().slice(11, 19),
          })
        }
      }
    })

    child.on('close', (code: number | null) => {
      if (timer) clearTimeout(timer)
      if (isSettled) return
      isSettled = true

      if (onUnregisterChild) onUnregisterChild(childId)
      if (stdoutBuf.trim()) handleLine(stdoutBuf)
      const finalPayload = finalPayloads[finalPayloads.length - 1]
      resolvePromise({
        ok: (code ?? 0) === 0,
        payload: finalPayload ?? { ok: false, error: 'No payload from python' },
        code: code ?? 0,
      })
    })

    child.on('error', (err: Error) => {
      if (timer) clearTimeout(timer)
      if (isSettled) return
      isSettled = true

      if (onUnregisterChild) onUnregisterChild(childId)
      onLog({
        level: 'error',
        message: `Failed to spawn python: ${err.message}`,
        ts: new Date().toISOString().slice(11, 19),
      })
      resolvePromise({ ok: false, payload: { ok: false, error: err.message }, code: -1 })
    })
  })
}

