/**
 * Integration tests for the API routes.
 *
 * These tests import the route handlers directly and call them with
 * synthesized NextRequest objects — no HTTP server required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// We need to mock the jobs module since it tries to spawn python processes
// and access the filesystem at module load time.
vi.mock('@/lib/jobs', () => {
  const mockJobs = {
    emitter: {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      setMaxListeners: vi.fn(),
    },
    getLogs: vi.fn(() => []),
    getSummary: vi.fn(() => ({ downloaded: 0, skipped: 0, failed: 0, total: 0 })),
    hasCookies: vi.fn(() => false),
    getCookiesRequested: vi.fn(() => false),
    fetch: vi.fn(),
    download: vi.fn(),
    downloadUrl: vi.fn(),
    downloadAll: vi.fn(),
    listFiles: vi.fn(() => []),
    listArchives: vi.fn(() => []),
    readFile: vi.fn(),
    readArchive: vi.fn(),
    deleteFile: vi.fn(),
    saveCookies: vi.fn(),
    deleteCookies: vi.fn(),
    stop: vi.fn(),
    resetSummary: vi.fn(),
    clearLogs: vi.fn(),
    clearHistory: vi.fn(),
  }
  return {
    jobs: mockJobs,
    getJobs: vi.fn(() => mockJobs),
    getOutputDir: vi.fn(() => '/tmp/test-output'),
    OUTPUT_DIR: '/tmp/test-output',
    COOKIES_FILE: '/tmp/test-cookies.txt',
    detectYouTubeCookiesError: vi.fn(() => false),
  }
})

vi.mock('@/lib/auth/request', () => ({
  getUserFromRequest: vi.fn(async () => ({ userId: 'user-123', username: 'testuser' })),
  getUserIdFromRequest: vi.fn(async () => 'user-123'),
}))

function makeRequest(url: string, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  if (!headers.has('Authorization')) {
    headers.set('Authorization', 'Bearer valid-token')
  }
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    ...init,
    headers,
  } as any)
}

describe('POST /api/spotify/fetch', () => {
  let handler: typeof import('@/app/api/spotify/fetch/route')

  beforeEach(async () => {
    vi.resetModules()
    handler = await import('@/app/api/spotify/fetch/route')
  })

  it('returns 400 for missing url', async () => {
    const req = makeRequest('http://localhost:3000/api/spotify/fetch', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await handler.POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.ok).toBe(false)
    expect(data.error).toMatch(/missing/i)
  })

  it('returns 400 for empty url string', async () => {
    const req = makeRequest('http://localhost:3000/api/spotify/fetch', {
      method: 'POST',
      body: JSON.stringify({ url: '  ' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await handler.POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = makeRequest('http://localhost:3000/api/spotify/fetch', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await handler.POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.ok).toBe(false)
  })
})

describe('POST /api/spotify/download', () => {
  let handler: typeof import('@/app/api/spotify/download/route')

  beforeEach(async () => {
    vi.resetModules()
    handler = await import('@/app/api/spotify/download/route')
  })

  it('returns 400 for missing track', async () => {
    const req = makeRequest('http://localhost:3000/api/spotify/download', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await handler.POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.ok).toBe(false)
    expect(data.error).toMatch(/track/i)
  })

  it('returns 400 for track without title', async () => {
    const req = makeRequest('http://localhost:3000/api/spotify/download', {
      method: 'POST',
      body: JSON.stringify({ track: { artist: 'Test' } }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await handler.POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = makeRequest('http://localhost:3000/api/spotify/download', {
      method: 'POST',
      body: 'xxx',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await handler.POST(req)
    expect(res.status).toBe(400)
  })
})

describe('POST /api/spotify/download-url', () => {
  let handler: typeof import('@/app/api/spotify/download-url/route')

  beforeEach(async () => {
    vi.resetModules()
    handler = await import('@/app/api/spotify/download-url/route')
  })

  it('returns 400 for missing url', async () => {
    const req = makeRequest('http://localhost:3000/api/spotify/download-url', {
      method: 'POST',
      body: JSON.stringify({ artist: 'A', title: 'T' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await handler.POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/missing/i)
  })

  it('returns 400 for missing artist', async () => {
    const req = makeRequest('http://localhost:3000/api/spotify/download-url', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://youtube.com/watch?v=xxx', title: 'T' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await handler.POST(req)
    expect(res.status).toBe(400)
  })
})

describe('POST /api/spotify/download-all', () => {
  let handler: typeof import('@/app/api/spotify/download-all/route')

  beforeEach(async () => {
    vi.resetModules()
    handler = await import('@/app/api/spotify/download-all/route')
  })

  it('returns 400 for empty tracks array', async () => {
    const req = makeRequest('http://localhost:3000/api/spotify/download-all', {
      method: 'POST',
      body: JSON.stringify({ tracks: [] }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await handler.POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/empty/i)
  })

  it('returns 400 for missing tracks', async () => {
    const req = makeRequest('http://localhost:3000/api/spotify/download-all', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await handler.POST(req)
    expect(res.status).toBe(400)
  })
})

describe('POST /api/spotify/stop', () => {
  let handler: typeof import('@/app/api/spotify/stop/route')

  beforeEach(async () => {
    vi.resetModules()
    handler = await import('@/app/api/spotify/stop/route')
  })

  it('returns ok:true', async () => {
    const req = makeRequest('http://localhost:3000/api/spotify/stop', {
      method: 'POST',
    })
    const res = await handler.POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
  })
})

describe('POST /api/spotify/reset-summary', () => {
  let handler: typeof import('@/app/api/spotify/reset-summary/route')

  beforeEach(async () => {
    vi.resetModules()
    handler = await import('@/app/api/spotify/reset-summary/route')
  })

  it('returns ok:true', async () => {
    const req = makeRequest('http://localhost:3000/api/spotify/reset-summary', {
      method: 'POST',
    })
    const res = await handler.POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
  })
})

describe('GET /api/spotify/cookies', () => {
  let handler: typeof import('@/app/api/spotify/cookies/route')

  beforeEach(async () => {
    vi.resetModules()
    handler = await import('@/app/api/spotify/cookies/route')
  })

  it('returns available status', async () => {
    const req = makeRequest('http://localhost:3000/api/spotify/cookies')
    const res = await handler.GET(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(typeof data.available).toBe('boolean')
  })
})

describe('POST /api/spotify/cookies', () => {
  let handler: typeof import('@/app/api/spotify/cookies/route')

  beforeEach(async () => {
    vi.resetModules()
    handler = await import('@/app/api/spotify/cookies/route')
  })

  it('returns 400 for empty content', async () => {
    const req = makeRequest('http://localhost:3000/api/spotify/cookies', {
      method: 'POST',
      body: JSON.stringify({ content: '' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await handler.POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON', async () => {
    const req = makeRequest('http://localhost:3000/api/spotify/cookies', {
      method: 'POST',
      body: 'notjson',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await handler.POST(req)
    expect(res.status).toBe(400)
  })
})

describe('GET /api/spotify/files', () => {
  let handler: typeof import('@/app/api/spotify/files/route')

  beforeEach(async () => {
    vi.resetModules()
    handler = await import('@/app/api/spotify/files/route')
  })

  it('returns file and archive lists', async () => {
    const req = makeRequest('http://localhost:3000/api/spotify/files')
    const res = await handler.GET(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(Array.isArray(data.files)).toBe(true)
    expect(Array.isArray(data.archives)).toBe(true)
    expect(typeof data.cookiesAvailable).toBe('boolean')
  })
})
