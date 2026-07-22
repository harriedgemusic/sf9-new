import { NextRequest } from 'next/server'
import { verifyToken, type JwtPayload } from '@/lib/auth'

/**
 * Extract and verify the authenticated user from the request's Authorization header.
 * Returns the JWT payload on success, or null if the request is unauthenticated.
 */
export async function getUserFromRequest(req: NextRequest): Promise<JwtPayload | null> {
  const authHeader = req.headers.get('authorization')
  let token = authHeader?.replace('Bearer ', '')
  if (!token) {
    // Fallback to query param for GET requests like file downloads via <a> tag
    token = req.nextUrl.searchParams.get('token') || undefined
  }
  if (!token) {
    // Fallback to cookie
    token = req.cookies.get('sf9-token')?.value || req.cookies.get('sf9-auth-token')?.value
  }
  if (!token) return null
  return verifyToken(token)
}

/**
 * Shortcut: extract userId from request, or return null.
 */
export async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  const user = await getUserFromRequest(req)
  return user?.userId ?? null
}