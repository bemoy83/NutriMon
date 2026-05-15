export const EAN_RE = /^\d{8,14}$/

export function normalizeEan(value: string): string | null {
  const digits = value.replace(/\D/g, '')
  return EAN_RE.test(digits) ? digits : null
}
