import { NextRequest } from 'next/server'

interface RateLimitRecord {
  count: number
  resetTime: number
}

const rateLimitMap = new Map<string, RateLimitRecord>()

/**
 * Clean up expired rate limit entries every 5 minutes.
 */
if (typeof globalThis !== 'undefined') {
  const cleanupInterval = 5 * 60 * 1000
  if (!(globalThis as any)._rateLimitCleanupTimer) {
    ;(globalThis as any)._rateLimitCleanupTimer = setInterval(() => {
      const now = Date.now()
      for (const [key, record] of rateLimitMap.entries()) {
        if (now > record.resetTime) {
          rateLimitMap.delete(key)
        }
      }
    }, cleanupInterval)
  }
}

export function getClientIp(req: NextRequest): string {
  const xForwardedFor = req.headers.get('x-forwarded-for')
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim()
  }
  const xRealIp = req.headers.get('x-real-ip')
  if (xRealIp) {
    return xRealIp.trim()
  }
  return '127.0.0.1'
}

/**
 * Simple sliding window rate limiter.
 * @param action Name of the action (e.g. 'login', '2fa-verify')
 * @param req NextRequest object to extract client IP
 * @param maxAttempts Maximum allowed attempts within window
 * @param windowMs Time window in milliseconds
 * @returns { isLimited: boolean, remaining: number, resetSeconds: number }
 */
export function checkRateLimit(
  action: string,
  req: NextRequest,
  maxAttempts = 10,
  windowMs = 60 * 1000
): { isLimited: boolean; remaining: number; resetSeconds: number } {
  const ip = getClientIp(req)
  const key = `${action}:${ip}`
  const now = Date.now()

  let record = rateLimitMap.get(key)

  if (!record || now > record.resetTime) {
    record = {
      count: 1,
      resetTime: now + windowMs,
    }
    rateLimitMap.set(key, record)
    return { isLimited: false, remaining: maxAttempts - 1, resetSeconds: Math.ceil(windowMs / 1000) }
  }

  record.count += 1
  const remaining = Math.max(0, maxAttempts - record.count)
  const resetSeconds = Math.ceil((record.resetTime - now) / 1000)

  if (record.count > maxAttempts) {
    return { isLimited: true, remaining: 0, resetSeconds }
  }

  return { isLimited: false, remaining, resetSeconds }
}
