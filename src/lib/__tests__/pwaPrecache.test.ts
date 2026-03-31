import { describe, expect, it } from 'vitest'
import {
  collectEagerAssetUrls,
  filterPrecacheEntries,
  stripBasePath,
  type BuildManifest,
} from '@/lib/pwaPrecache'

describe('pwaPrecache', () => {
  it('collects the entry graph through static imports only', () => {
    const manifest: BuildManifest = {
      'index.html': {
        file: 'assets/app.js',
        css: ['assets/app.css'],
        assets: ['assets/logo.svg'],
        imports: ['vendor.js'],
        dynamicImports: [
          'src/pages/auth/LoginPage.tsx',
          'src/features/logging/QuickAddSheet.tsx',
          'src/features/weight/WeightHistoryChart.tsx',
        ],
        isEntry: true,
      },
      'vendor.js': {
        file: 'assets/vendor.js',
        imports: ['shared.js'],
      },
      'shared.js': {
        file: 'assets/shared.js',
        css: ['assets/shared.css'],
      },
      'src/pages/auth/LoginPage.tsx': {
        file: 'assets/login.js',
      },
      'src/features/logging/QuickAddSheet.tsx': {
        file: 'assets/quick-add.js',
      },
      'src/features/weight/WeightHistoryChart.tsx': {
        file: 'assets/chart.js',
        css: ['assets/chart.css'],
      },
    }

    expect([...collectEagerAssetUrls(manifest, 'index.html')]).toEqual([
      'assets/app.js',
      'assets/app.css',
      'assets/logo.svg',
      'assets/vendor.js',
      'assets/shared.js',
      'assets/shared.css',
    ])
  })

  it('filters precache entries to the eager graph and static shell urls', () => {
    const eagerAssetUrls = new Set([
      'assets/app.js',
      'assets/app.css',
      'assets/vendor.js',
    ])
    const staticShellUrls = new Set([
      'index.html',
      'manifest.webmanifest',
      'registerSW.js',
      'favicon.svg',
      'icons.svg',
    ])

    const manifestEntries = [
      { url: '/index.html' },
      { url: '/manifest.webmanifest' },
      { url: '/assets/app.js' },
      { url: '/assets/app.css' },
      { url: '/assets/vendor.js' },
      { url: '/assets/login.js' },
      { url: '/assets/quick-add.js' },
      { url: '/assets/chart.js' },
    ]

    expect(filterPrecacheEntries(manifestEntries, '/', eagerAssetUrls, staticShellUrls)).toEqual([
      { url: '/index.html' },
      { url: '/manifest.webmanifest' },
      { url: '/assets/app.js' },
      { url: '/assets/app.css' },
      { url: '/assets/vendor.js' },
    ])
  })

  it('strips base paths for root and subpath deployments', () => {
    expect(stripBasePath('/assets/app.js', '/')).toBe('assets/app.js')
    expect(stripBasePath('/nutrimon/assets/app.js', '/nutrimon/')).toBe('assets/app.js')
    expect(stripBasePath('nutrimon/registerSW.js', '/nutrimon/')).toBe('registerSW.js')
  })
})
