import { describe, expect, it } from 'vitest'
import { normalizeEan } from '../ean'

describe('normalizeEan', () => {
  it('accepts 8-14 digits after stripping separators', () => {
    expect(normalizeEan('70 38-011234567')).toBe('7038011234567')
    expect(normalizeEan('12345678')).toBe('12345678')
  })

  it('rejects non-EAN scanner payloads and wrong lengths', () => {
    expect(normalizeEan('not a barcode')).toBeNull()
    expect(normalizeEan('1234567')).toBeNull()
    expect(normalizeEan('123456789012345')).toBeNull()
  })
})
