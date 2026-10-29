export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeEmail(value) {
  return String(value || '').trim()
}

export function isValidEmail(value) {
  const email = normalizeEmail(value)
  return email.length <= 254 && EMAIL_PATTERN.test(email)
}
