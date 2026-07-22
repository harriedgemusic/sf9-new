import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

/**
 * Minimal TOTP implementation (RFC 6238).
 * No external dependency — uses only Node.js crypto.
 *
 * TOTP = HMAC-SHA1(secret, counter) truncated to 6 digits.
 * Counter = floor(now / 30)
 */

function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const cleaned = input.toUpperCase().replace(/[^A-Z2-7]/g, '')
  const bits: number[] = []

  for (let i = 0; i < cleaned.length; i++) {
    const val = alphabet.indexOf(cleaned[i])
    if (val === -1) continue
    bits.push((val >> 4) & 1, (val >> 3) & 1, (val >> 2) & 1, (val >> 1) & 1, (val >> 0) & 1)
  }

  const bytes: number[] = []
  for (let i = 0; i + 7 < bits.length; i += 8) {
    bytes.push(
      (bits[i] << 7) | (bits[i + 1] << 6) | (bits[i + 2] << 5) | (bits[i + 3] << 4) |
      (bits[i + 4] << 3) | (bits[i + 5] << 2) | (bits[i + 6] << 1) | (bits[i + 7])
    )
  }
  return Buffer.from(bytes)
}

function base32Encode(buf: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = 0
  let value = 0
  let output = ''

  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i]
    bits += 8
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31]
  }

  // Pad to multiple of 8
  while (output.length % 8 !== 0) output += '='
  return output
}


function generateTotp(secret: Buffer, offsetStep = 0, timeStep = 30, digits = 6): { code: string; remaining: number } {
  const currentSeconds = Math.floor(Date.now() / 1000)
  const counter = Math.floor(currentSeconds / timeStep) + offsetStep
  const remaining = timeStep - (currentSeconds % timeStep)

  // counter as 8-byte big-endian
  const counterBuf = Buffer.alloc(8)
  counterBuf.writeBigInt64BE(BigInt(counter))

  const hmac = createHmac('sha1', secret).update(counterBuf).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const binCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)

  const code = (binCode % Math.pow(10, digits)).toString().padStart(digits, '0')
  return { code, remaining }
}

export function generateSecret(): string {
  return base32Encode(randomBytes(20))
}

export function getTotpUri(secret: string, username: string, issuer = 'SF9'): string {
  const encodedIssuer = encodeURIComponent(issuer)
  const encodedLabel = encodeURIComponent(`${issuer}:${username}`)
  return `otpauth://totp/${encodedLabel}?secret=${secret.replace(/=+$/, '')}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`
}

export function verifyTotp(secret: string, token: string, window = 1): { ok: boolean; remaining: number } {
  if (!token || typeof token !== 'string' || token.length !== 6) {
    return { ok: false, remaining: 0 }
  }

  const buf = base32Decode(secret)
  const userTokenBuf = Buffer.from(token)
  let valid = false
  let currentRemaining = 30

  // Check window steps: -1, 0, +1
  for (let offset = -window; offset <= window; offset++) {
    const { code, remaining } = generateTotp(buf, offset)
    if (offset === 0) currentRemaining = remaining

    const codeBuf = Buffer.from(code)
    if (codeBuf.length === userTokenBuf.length && timingSafeEqual(codeBuf, userTokenBuf)) {
      valid = true
    }
  }

  return { ok: valid, remaining: currentRemaining }
}

/**
 * Generate a 6-digit recovery key that can be used to bypass 2FA in emergencies.
 */
export function generateTOTPRecoveryKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < 16; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  // Format as XXXX-XXXX-XXXX-XXXX
  return result.match(/.{1,4}/g)!.join('-')
}