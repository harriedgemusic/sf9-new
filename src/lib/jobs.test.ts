import { describe, it, expect } from 'vitest'
import { detectYouTubeCookiesError } from '@/lib/jobs'

describe('detectYouTubeCookiesError', () => {
  it('returns true for "Sign in to confirm you\'re not a bot"', () => {
    expect(detectYouTubeCookiesError("Sign in to confirm you're not a bot")).toBe(true)
  })

  it('returns true for "Sign in to confirm youre not a bot" (no apostrophe)', () => {
    expect(detectYouTubeCookiesError("Sign in to confirm youre not a bot")).toBe(true)
  })

  it('returns true for cookies-from-browser messages', () => {
    expect(detectYouTubeCookiesError("Use --cookies-from-browser to fix this")).toBe(true)
    expect(detectYouTubeCookiesError("cookies_from_browser")).toBe(true)
  })

  it('returns true for "Sign in to confirm"', () => {
    expect(detectYouTubeCookiesError("Sign in to confirm your identity")).toBe(true)
  })

  it('returns false for normal error messages', () => {
    expect(detectYouTubeCookiesError("Network timeout")).toBe(false)
    expect(detectYouTubeCookiesError("Video not found")).toBe(false)
    expect(detectYouTubeCookiesError("")).toBe(false)
  })

  it('returns false for null/undefined-like input', () => {
    expect(detectYouTubeCookiesError("")).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(detectYouTubeCookiesError("SIGN IN TO CONFIRM YOU'RE NOT A BOT")).toBe(true)
    expect(detectYouTubeCookiesError("sign in to confirm")).toBe(true)
  })
})
