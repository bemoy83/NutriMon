import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const originalWindowLocation = window.location

function setWindowOrigin(origin: string) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { origin },
  })
}

describe('appUrl helpers', () => {
  beforeEach(() => {
    vi.resetModules()
    setWindowOrigin('https://bemoy.github.io')
    vi.unstubAllEnvs()
  })

  it('builds browser-mode URLs with a subpath base', async () => {
    vi.stubEnv('BASE_URL', '/NutriMon/')
    vi.stubEnv('VITE_ROUTER_MODE', 'browser')

    const { getExternalAppUrl } = await import('../appUrl')
    expect(getExternalAppUrl('/login')).toBe('https://bemoy.github.io/NutriMon/login')
  })

  it('builds hash-mode URLs with a subpath base', async () => {
    vi.stubEnv('BASE_URL', '/NutriMon/')
    vi.stubEnv('VITE_ROUTER_MODE', 'hash')

    const { getExternalAppUrl } = await import('../appUrl')
    expect(getExternalAppUrl('/login')).toBe('https://bemoy.github.io/NutriMon/#/login')
  })

  it('normalizes empty base paths to root', async () => {
    const { normalizeBasePath } = await import('../appUrl')
    expect(normalizeBasePath('')).toBe('/')
    expect(normalizeBasePath('NutriMon')).toBe('/NutriMon/')
  })
})

afterAll(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: originalWindowLocation,
  })
})
