import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({
  db: {
    $queryRaw: vi.fn(async () => [{ 1: 1 }]),
  },
}))

describe('GET /api/health', () => {
  it('returns status ok and database connected info when healthy', async () => {
    const { GET } = await import('@/app/api/health/route')
    const req = new NextRequest('http://localhost:3000/api/health')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.status).toBe('ok')
    expect(data.database.status).toBe('connected')
    expect(typeof data.database.latencyMs).toBe('number')
  })
})
