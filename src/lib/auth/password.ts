import { hash, compare } from 'bcryptjs'

const SALT_ROUNDS = 12

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, SALT_ROUNDS)
}

export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  return compare(plain, hashed)
}

export function isValidPassword(pw: string): boolean {
  return pw.length >= 6 && pw.length <= 128
}

export function isValidUsername(u: string): boolean {
  return /^[a-zA-Z0-9._-]{2,32}$/.test(u)
}