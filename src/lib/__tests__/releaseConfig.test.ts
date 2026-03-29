import { describe, expect, it } from 'vitest'
import configToml from '../../../supabase/config.toml?raw'

describe('release config regressions', () => {
  it('keeps finalize-day configured with verify_jwt disabled', () => {
    expect(configToml).toContain('[functions.finalize-day]')
    expect(configToml).toContain('verify_jwt = false')
  })

  it('keeps auto-finalize-day configured with verify_jwt disabled for secret-header auth', () => {
    expect(configToml).toContain('[functions.auto-finalize-day]')
    expect(configToml).toContain('verify_jwt = false')
  })
})
