import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Mock prisma db
vi.mock('@/lib/db', () => {
  const mockUsers = [
    {
      id: 'admin-id',
      username: 'admin',
      isAdmin: true,
      totpEnabled: false,
      passwordHash: 'hashed',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'user-id-1',
      username: 'testuser',
      isAdmin: false,
      totpEnabled: false,
      passwordHash: 'hashed',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]

  const mockDownloadLogs = [
    {
      id: 'log-1',
      userId: 'user-id-1',
      trackTitle: 'Track 1',
      trackArtist: 'Artist 1',
      searchMode: 'extended',
      status: 'downloaded',
      createdAt: new Date(),
    },
    {
      id: 'log-2',
      userId: 'user-id-1',
      trackTitle: 'Track 2',
      trackArtist: 'Artist 2',
      searchMode: 'simple',
      status: 'downloaded',
      createdAt: new Date(),
    },
  ]

  return {
    db: {
      user: {
        findMany: vi.fn(async () => mockUsers),
        findUnique: vi.fn(async ({ where }) => {
          if (where.id) return mockUsers.find((u) => u.id === where.id) || null
          if (where.username) return mockUsers.find((u) => u.username === where.username) || null
          return null
        }),
        create: vi.fn(async ({ data }) => ({
          id: 'new-user-id',
          username: data.username,
          isAdmin: data.isAdmin || false,
          totpEnabled: false,
          createdAt: new Date(),
        })),
        update: vi.fn(async () => ({ id: 'user-id-1' })),
        delete: vi.fn(async () => ({ id: 'user-id-1' })),
      },
      session: {
        deleteMany: vi.fn(async () => ({ count: 1 })),
      },
      downloadLog: {
        findMany: vi.fn(async () => mockDownloadLogs),
        count: vi.fn(async ({ where }) => {
          if (where.searchMode === 'extended') return 1
          if (where.searchMode === 'simple') return 1
          return 2
        }),
      },
    },
  }
})

// Mock auth helpers
vi.mock('@/lib/auth/request', () => ({
  getUserFromRequest: vi.fn(async (req: NextRequest) => {
    const auth = req.headers.get('authorization')
    if (auth === 'Bearer admin-token') {
      return { userId: 'admin-id', username: 'admin', isAdmin: true }
    }
    if (auth === 'Bearer user-token') {
      return { userId: 'user-id-1', username: 'testuser', isAdmin: false }
    }
    return null
  }),
}))

describe('Admin User Management API Routes', () => {
  describe('GET /api/admin/users', () => {
    it('returns 401 when unauthenticated', async () => {
      const { GET } = await import('@/app/api/admin/users/route')
      const req = new NextRequest('http://localhost:3000/api/admin/users')
      const res = await GET(req)
      expect(res.status).toBe(401)
    })

    it('returns 403 when logged in as non-admin user', async () => {
      const { GET } = await import('@/app/api/admin/users/route')
      const req = new NextRequest('http://localhost:3000/api/admin/users', {
        headers: { authorization: 'Bearer user-token' },
      })
      const res = await GET(req)
      expect(res.status).toBe(403)
    })

    it('returns users list when requested by admin', async () => {
      const { GET } = await import('@/app/api/admin/users/route')
      const req = new NextRequest('http://localhost:3000/api/admin/users', {
        headers: { authorization: 'Bearer admin-token' },
      })
      const res = await GET(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(Array.isArray(data.users)).toBe(true)
      expect(data.users.length).toBeGreaterThan(0)
    })
  })

  describe('POST /api/admin/users', () => {
    it('creates new user when requested by admin', async () => {
      const { POST } = await import('@/app/api/admin/users/route')
      const req = new NextRequest('http://localhost:3000/api/admin/users', {
        method: 'POST',
        headers: { authorization: 'Bearer admin-token', 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'newuser', password: 'password123' }),
      })
      const res = await POST(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.user.username).toBe('newuser')
    })

    it('returns 400 if username or password is too short', async () => {
      const { POST } = await import('@/app/api/admin/users/route')
      const req = new NextRequest('http://localhost:3000/api/admin/users', {
        method: 'POST',
        headers: { authorization: 'Bearer admin-token', 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'a', password: '123' }),
      })
      const res = await POST(req)
      expect(res.status).toBe(400)
    })
  })

  describe('PUT & DELETE /api/admin/users/[id]', () => {
    it('updates user password on PUT', async () => {
      const { PUT } = await import('@/app/api/admin/users/[id]/route')
      const req = new NextRequest('http://localhost:3000/api/admin/users/user-id-1', {
        method: 'PUT',
        headers: { authorization: 'Bearer admin-token', 'content-type': 'application/json' },
        body: JSON.stringify({ newPassword: 'newpassword123' }),
      })
      const res = await PUT(req, { params: Promise.resolve({ id: 'user-id-1' }) })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
    })

    it('prevents self-deletion on DELETE for admin', async () => {
      const { DELETE } = await import('@/app/api/admin/users/[id]/route')
      const req = new NextRequest('http://localhost:3000/api/admin/users/admin-id', {
        method: 'DELETE',
        headers: { authorization: 'Bearer admin-token' },
      })
      const res = await DELETE(req, { params: Promise.resolve({ id: 'admin-id' }) })
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain('Cannot delete your own admin account')
    })

    it('deletes user on DELETE', async () => {
      const { DELETE } = await import('@/app/api/admin/users/[id]/route')
      const req = new NextRequest('http://localhost:3000/api/admin/users/user-id-1', {
        method: 'DELETE',
        headers: { authorization: 'Bearer admin-token' },
      })
      const res = await DELETE(req, { params: Promise.resolve({ id: 'user-id-1' }) })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
    })
  })

  describe('GET /api/admin/users/[id]/stats', () => {
    it('returns user download stats and history', async () => {
      const { GET } = await import('@/app/api/admin/users/[id]/stats/route')
      const req = new NextRequest('http://localhost:3000/api/admin/users/user-id-1/stats', {
        headers: { authorization: 'Bearer admin-token' },
      })
      const res = await GET(req, { params: Promise.resolve({ id: 'user-id-1' }) })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.stats.extendedCount).toBe(1)
      expect(data.stats.simpleCount).toBe(1)
    })
  })
})
