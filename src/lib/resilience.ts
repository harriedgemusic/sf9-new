/**
 * Maestro Fortification Module - Resilience, Retries, Circuit Breakers, and Safety Controls.
 *
 * Implements 5-Layer Defense-in-Depth for async operations, external APIs, and jobs:
 *  - Layer 1: Input Validation
 *  - Layer 2: Retry with Exponential Backoff
 *  - Layer 3: Fallback & Graceful Degradation
 *  - Layer 4: Circuit Breakers
 *  - Layer 5: Timeout Controls
 */

// ---------------------------------------------------------------------------
// Custom Errors
// ---------------------------------------------------------------------------

export class ResilienceError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message)
    this.name = 'ResilienceError'
  }
}

export class TimeoutError extends ResilienceError {
  constructor(timeoutMs: number) {
    super(`Operation timed out after ${timeoutMs}ms`, 'TIMEOUT')
    this.name = 'TimeoutError'
  }
}

export class CircuitBreakerOpenError extends ResilienceError {
  constructor(public readonly serviceName: string) {
    super(`Circuit breaker for '${serviceName}' is OPEN`, 'CIRCUIT_OPEN')
    this.name = 'CircuitBreakerOpenError'
  }
}

export class ValidationError extends ResilienceError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR')
    this.name = 'ValidationError'
  }
}

// ---------------------------------------------------------------------------
// Layer 1: Input Validation
// ---------------------------------------------------------------------------

export interface ValidationOptions {
  maxLength?: number
  allowedSchemes?: string[]
}

/**
 * Validates and sanitizes generic input strings or URLs.
 */
export function validateInput(input: unknown, fieldName: string, options: ValidationOptions = {}): string {
  if (typeof input !== 'string' || !input.trim()) {
    throw new ValidationError(`Field '${fieldName}' must be a non-empty string`)
  }

  const trimmed = input.trim()

  if (options.maxLength && trimmed.length > options.maxLength) {
    throw new ValidationError(`Field '${fieldName}' exceeds maximum length of ${options.maxLength} characters`)
  }

  if (options.allowedSchemes && options.allowedSchemes.length > 0) {
    try {
      const parsedUrl = new URL(trimmed)
      if (!options.allowedSchemes.includes(parsedUrl.protocol.replace(':', ''))) {
        throw new ValidationError(`URL scheme '${parsedUrl.protocol}' is not allowed for '${fieldName}'`)
      }
    } catch (err) {
      if (err instanceof ValidationError) throw err
      throw new ValidationError(`Field '${fieldName}' is not a valid URL`)
    }
  }

  return trimmed
}

// ---------------------------------------------------------------------------
// Layer 2: Retry with Exponential Backoff
// ---------------------------------------------------------------------------

export interface RetryOptions {
  maxRetries?: number
  initialDelayMs?: number
  backoffMultiplier?: number
  maxDelayMs?: number
  retryableErrors?: (err: any) => boolean
}

const DEFAULT_RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504])

export function isRetryableError(err: any): boolean {
  if (!err) return false
  if (err instanceof TimeoutError) return true
  if (err.name === 'AbortError' || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') return true
  if (typeof err.status === 'number' && DEFAULT_RETRYABLE_STATUSES.has(err.status)) return true
  if (typeof err.statusCode === 'number' && DEFAULT_RETRYABLE_STATUSES.has(err.statusCode)) return true
  return false
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3
  const initialDelayMs = options.initialDelayMs ?? 100
  const backoffMultiplier = options.backoffMultiplier ?? 2
  const maxDelayMs = options.maxDelayMs ?? 5000
  const shouldRetry = options.retryableErrors ?? isRetryableError

  let currentDelay = initialDelayMs
  let attempt = 0

  while (true) {
    try {
      attempt++
      return await fn()
    } catch (err) {
      if (attempt > maxRetries || !shouldRetry(err)) {
        throw err
      }

      // Add slight jitter
      const jitter = Math.random() * 50
      const delay = Math.min(currentDelay + jitter, maxDelayMs)
      await new Promise((resolve) => setTimeout(resolve, delay))
      currentDelay *= backoffMultiplier
    }
  }
}

// ---------------------------------------------------------------------------
// Layer 3: Fallback & Graceful Degradation
// ---------------------------------------------------------------------------

export async function withFallback<T>(
  primaryFn: () => Promise<T>,
  fallbackFn: (err: any) => Promise<T> | T
): Promise<T> {
  try {
    return await primaryFn()
  } catch (err) {
    return await fallbackFn(err)
  }
}

// ---------------------------------------------------------------------------
// Layer 4: Circuit Breaker
// ---------------------------------------------------------------------------

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export interface CircuitBreakerOptions {
  failureThreshold?: number
  cooldownMs?: number
  halfOpenMaxRequests?: number
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED'
  private failureCount = 0
  private lastStateChangeTime = Date.now()
  private halfOpenRequestCount = 0

  private readonly failureThreshold: number
  private readonly cooldownMs: number
  private readonly halfOpenMaxRequests: number

  constructor(public readonly serviceName: string, options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5
    this.cooldownMs = options.cooldownMs ?? 60000
    this.halfOpenMaxRequests = options.halfOpenMaxRequests ?? 1
  }

  getState(): CircuitState {
    if (this.state === 'OPEN' && Date.now() - this.lastStateChangeTime >= this.cooldownMs) {
      this.state = 'HALF_OPEN'
      this.halfOpenRequestCount = 0
      this.lastStateChangeTime = Date.now()
    }
    return this.state
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.getState()

    if (currentState === 'OPEN') {
      throw new CircuitBreakerOpenError(this.serviceName)
    }

    if (currentState === 'HALF_OPEN' && this.halfOpenRequestCount >= this.halfOpenMaxRequests) {
      throw new CircuitBreakerOpenError(this.serviceName)
    }

    if (currentState === 'HALF_OPEN') {
      this.halfOpenRequestCount++
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (err) {
      this.onFailure()
      throw err
    }
  }

  private onSuccess() {
    this.failureCount = 0
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED'
      this.lastStateChangeTime = Date.now()
    }
  }

  private onFailure() {
    this.failureCount++
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN'
      this.lastStateChangeTime = Date.now()
    }
  }

  reset() {
    this.state = 'CLOSED'
    this.failureCount = 0
    this.halfOpenRequestCount = 0
    this.lastStateChangeTime = Date.now()
  }
}

// ---------------------------------------------------------------------------
// Layer 5: Timeout Controls
// ---------------------------------------------------------------------------

export async function withTimeout<T>(
  fn: (signal?: AbortSignal) => Promise<T>,
  timeoutMs: number
): Promise<T> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | null = null

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new TimeoutError(timeoutMs))
    }, timeoutMs)
  })

  try {
    return await Promise.race([fn(controller.signal), timeoutPromise])
  } finally {
    if (timer) clearTimeout(timer)
  }
}
