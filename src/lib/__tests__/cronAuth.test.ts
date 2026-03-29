import { describe, expect, it } from 'vitest'
import { getCronAuthError } from '../../../supabase/functions/_shared/cronAuth.ts'

describe('getCronAuthError', () => {
  it('rejects when the shared secret is missing', () => {
    expect(getCronAuthError(new Headers(), null)).toBe('CRON_SHARED_SECRET not configured')
  })

  it('rejects when the header is missing', () => {
    expect(getCronAuthError(new Headers(), 'secret')).toBe('Missing cron secret')
  })

  it('rejects when the header is wrong', () => {
    const headers = new Headers({ 'x-cron-secret': 'wrong' })
    expect(getCronAuthError(headers, 'secret')).toBe('Invalid cron secret')
  })

  it('accepts when the header matches', () => {
    const headers = new Headers({ 'x-cron-secret': 'secret' })
    expect(getCronAuthError(headers, 'secret')).toBeNull()
  })
})
