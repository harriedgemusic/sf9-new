import { SignJWT, jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-dev-secret-do-not-use-in-production'
)

export interface JwtPayload {
  userId: string
  username: string
  isAdmin?: boolean
}

export async function signToken(payload: JwtPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('14d')
    .sign(JWT_SECRET)
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return {
      userId: payload.userId as string,
      username: payload.username as string,
      isAdmin: Boolean(payload.isAdmin),
    }
  } catch {
    return null
  }
}

/**
 * Short-lived token for intermediate auth state (e.g., between login and 2FA prompt).
 * Expires in 5 minutes — only used to carry the authenticated userId before
 * the full session token is issued after 2FA verification.
 */
export async function signPartialToken(payload: JwtPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(JWT_SECRET)
}

export async function verifyPartialToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return { userId: payload.userId as string, username: payload.username as string }
  } catch {
    return null
  }
}