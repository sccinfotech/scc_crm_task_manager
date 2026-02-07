import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16
const KEY_LENGTH = 32

/**
 * Get the encryption key from environment. Returns null if not set or invalid.
 * When set: PROJECT_AMOUNT_ENCRYPTION_KEY must be 32-byte key as hex (64 chars) or base64 (44 chars).
 * When not set: amounts are stored as plain numeric strings (no encryption).
 */
function getKey(): Buffer | null {
  const raw = process.env.PROJECT_AMOUNT_ENCRYPTION_KEY?.trim()
  if (!raw || raw.length < 32) return null
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex')
  }
  const buf = Buffer.from(raw, 'base64')
  if (buf.length !== KEY_LENGTH) return null
  return buf
}

/**
 * Encrypt a numeric amount for storage. Returns null for null input.
 * When PROJECT_AMOUNT_ENCRYPTION_KEY is set: stored as base64(iv || ciphertext || authTag).
 * When not set: stored as plain numeric string (legacy).
 */
export function encryptAmount(amount: number | null): string | null {
  if (amount === null || amount === undefined) return null
  const key = getKey()
  if (!key) return String(amount)
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  const plain = String(amount)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, encrypted, authTag]).toString('base64')
}

/**
 * Decrypt a stored value back to a number. Returns null for null/empty or if decryption fails.
 * Supports legacy plain numeric strings (e.g. "1234.56") for backward compatibility.
 */
export function decryptAmount(encrypted: string | null | undefined): number | null {
  if (encrypted === null || encrypted === undefined || encrypted === '') return null
  const trimmed = String(encrypted).trim()
  if (!trimmed) return null

  // Legacy: if it looks like a plain number (no base64 padding / typical ciphertext), parse as number
  const asNumber = Number.parseFloat(trimmed)
  if (!trimmed.includes('=') && /^-?[\d.]+$/.test(trimmed) && Number.isFinite(asNumber)) {
    return asNumber
  }

  const key = getKey()
  if (!key) return null

  try {
    const buf = Buffer.from(trimmed, 'base64')
    if (buf.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) return null
    const iv = buf.subarray(0, IV_LENGTH)
    const authTag = buf.subarray(buf.length - AUTH_TAG_LENGTH)
    const ciphertext = buf.subarray(IV_LENGTH, buf.length - AUTH_TAG_LENGTH)
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
    decipher.setAuthTag(authTag)
    const decrypted = decipher.update(ciphertext) + decipher.final('utf8')
    const value = Number.parseFloat(decrypted)
    return Number.isFinite(value) ? value : null
  } catch {
    return null
  }
}
