/**
 * Log Buffer & Event Emitter helper for Jobs service
 */

import { EventEmitter } from 'events'
import type { LogEntry, LogLevel } from './types'

export class LogBufferManager {
  private buffer: LogEntry[] = []
  private readonly maxEntries: number
  readonly emitter: EventEmitter

  constructor(maxEntries = 500, emitter?: EventEmitter) {
    this.maxEntries = maxEntries
    this.emitter = emitter || new EventEmitter()
    this.emitter.setMaxListeners(100)
  }

  pushLog(level: LogLevel, message: string, extra?: Record<string, unknown>): LogEntry {
    const entry: LogEntry = {
      level,
      message,
      ts: new Date().toISOString().slice(11, 19),
      ...(extra ? { extra } : {}),
    }

    this.buffer.push(entry)
    if (this.buffer.length > this.maxEntries) {
      this.buffer.shift()
    }

    this.emitter.emit('log', entry)
    return entry
  }

  getLogs(): LogEntry[] {
    return [...this.buffer]
  }

  clear(): void {
    this.buffer = []
    this.emitter.emit('logs-cleared', { at: Date.now() })
  }
}
