import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  validateInput,
  ValidationError,
  withRetry,
  withFallback,
  CircuitBreaker,
  CircuitBreakerOpenError,
  withTimeout,
  TimeoutError,
} from './resilience'

describe('Maestro Fortification Resilience Module', () => {
  describe('Layer 1: Input Validation', () => {
    it('validates non-empty string', () => {
      expect(validateInput('test', 'fieldName')).toBe('test')
      expect(() => validateInput('', 'fieldName')).toThrow(ValidationError)
      expect(() => validateInput(123, 'fieldName')).toThrow(ValidationError)
    })

    it('enforces maxLength', () => {
      expect(() => validateInput('long string', 'field', { maxLength: 5 })).toThrow(ValidationError)
    })

    it('validates allowed URL schemes', () => {
      expect(validateInput('https://spotify.com', 'url', { allowedSchemes: ['http', 'https'] })).toBe('https://spotify.com')
      expect(() => validateInput('ftp://spotify.com', 'url', { allowedSchemes: ['http', 'https'] })).toThrow(ValidationError)
    })
  })

  describe('Layer 2: Retry with Backoff', () => {
    it('retries transient failures and eventually succeeds', async () => {
      let attempts = 0
      const fn = vi.fn(async () => {
        attempts++
        if (attempts < 3) {
          const err = new Error('Rate limited')
          ;(err as any).status = 429
          throw err
        }
        return 'success'
      })

      const result = await withRetry(fn, { maxRetries: 3, initialDelayMs: 10, backoffMultiplier: 1.5 })
      expect(result).toBe('success')
      expect(attempts).toBe(3)
    })

    it('does not retry non-retryable errors', async () => {
      let attempts = 0
      const fn = vi.fn(async () => {
        attempts++
        const err = new Error('Bad request')
        ;(err as any).status = 400
        throw err
      })

      await expect(withRetry(fn, { maxRetries: 3, initialDelayMs: 10 })).rejects.toThrow('Bad request')
      expect(attempts).toBe(1)
    })
  })

  describe('Layer 3: Fallback Responses', () => {
    it('returns primary result when successful', async () => {
      const result = await withFallback(
        async () => 'primary',
        async () => 'fallback'
      )
      expect(result).toBe('primary')
    })

    it('returns fallback result when primary fails', async () => {
      const result = await withFallback(
        async () => { throw new Error('Primary failed') },
        async () => 'fallback'
      )
      expect(result).toBe('fallback')
    })
  })

  describe('Layer 4: Circuit Breaker', () => {
    it('transitions CLOSED -> OPEN on reaching failure threshold', async () => {
      const cb = new CircuitBreaker('test-service', { failureThreshold: 2, cooldownMs: 1000 })

      expect(cb.getState()).toBe('CLOSED')

      await expect(cb.execute(async () => { throw new Error('err 1') })).rejects.toThrow('err 1')
      expect(cb.getState()).toBe('CLOSED')

      await expect(cb.execute(async () => { throw new Error('err 2') })).rejects.toThrow('err 2')
      expect(cb.getState()).toBe('OPEN')

      await expect(cb.execute(async () => 'ok')).rejects.toThrow(CircuitBreakerOpenError)
    })
  })

  describe('Layer 5: Timeout Controls', () => {
    it('resolves if within timeout', async () => {
      const result = await withTimeout(async () => 'quick', 500)
      expect(result).toBe('quick')
    })

    it('throws TimeoutError if operation exceeds timeout', async () => {
      const longFn = () => new Promise((resolve) => setTimeout(resolve, 300))
      await expect(withTimeout(longFn, 50)).rejects.toThrow(TimeoutError)
    })
  })
})
