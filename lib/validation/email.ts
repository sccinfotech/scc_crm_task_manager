const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const EMAIL_INPUT_PATTERN = '[^\\s@]+@[^\\s@]+\\.[^\\s@]+'
export const EMAIL_VALIDATION_MESSAGE = 'Please enter a valid email address.'

export function normalizeRequiredEmail(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

export function normalizeOptionalEmail(value: string | null | undefined): string | null {
  const normalized = normalizeRequiredEmail(value)
  return normalized.length > 0 ? normalized : null
}

export function isValidEmailFormat(email: string): boolean {
  return EMAIL_REGEX.test(email)
}
