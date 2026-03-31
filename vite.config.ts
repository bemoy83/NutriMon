import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { loadEnv } from 'vite'

interface ManifestChunk {
  file: string
  css?: string[]
  assets?: string[]
  imports?: string[]
  isEntry?: boolean
}

type BuildManifest = Record<string, ManifestChunk>

function normalizeBasePath(value?: string): string {
  const trimmed = (value ?? '/').trim()
  if (!trimmed || trimmed === '/') return '/'
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function stripBasePath(url: string, basePath: string): string {
  const normalizedUrl = url.startsWith('/') ? url.slice(1) : url
  const normalizedBase = basePath === '/' ? '' : basePath.replace(/^\/|\/$/g, '')

  if (normalizedBase && normalizedUrl.startsWith(`${normalizedBase}/`)) {
    return normalizedUrl.slice(normalizedBase.length + 1)
  }

  return normalizedUrl
}

function loadEagerAssetUrls(manifestPath: string): Set<string> {
  if (!existsSync(manifestPath)) {
    throw new Error(`Missing Vite manifest at ${manifestPath}`)
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as BuildManifest
  const entryKey =
    Object.keys(manifest).find((key) => key === 'index.html') ??
    Object.keys(manifest).find((key) => manifest[key]?.isEntry)

  if (!entryKey) {
    throw new Error('Unable to locate the Vite entry chunk in the build manifest')
  }

  const eagerUrls = new Set<string>()
  const visited = new Set<string>()

  function visitChunk(chunkKey: string) {
    if (visited.has(chunkKey)) return
    visited.add(chunkKey)

    const chunk = manifest[chunkKey]
    if (!chunk) return

    eagerUrls.add(chunk.file)
    chunk.css?.forEach((cssFile) => eagerUrls.add(cssFile))
    chunk.assets?.forEach((assetFile) => eagerUrls.add(assetFile))
    chunk.imports?.forEach((importKey) => visitChunk(importKey))
  }

  visitChunk(entryKey)
  return eagerUrls
}

function isPrecacheUrl(url: string, basePath: string, eagerAssetUrls: Set<string>): boolean {
  const path = stripBasePath(url, basePath)
  return eagerAssetUrls.has(path)
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const basePath = normalizeBasePath(env.VITE_APP_BASE_PATH)
  const routerMode = env.VITE_ROUTER_MODE === 'hash' ? 'hash' : 'browser'
  const outDir = 'dist'
  const manifestPath = resolve(process.cwd(), outDir, '.vite', 'manifest.json')
  const manifestStartUrl = routerMode === 'hash' ? `${basePath}#/` : basePath
  const assetFilePattern = new RegExp(`^${escapeRegex(basePath)}assets\\/.*\\.(?:js|css)$`)

  return {
    base: basePath,
    build: {
      manifest: true,
      outDir,
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'NutriMon',
          short_name: 'NutriMon',
          description: 'Behavior-driven nutrition tracker with companion creature',
          theme_color: '#0f172a',
          background_color: '#0f172a',
          display: 'standalone',
          orientation: 'portrait',
          scope: basePath,
          start_url: manifestStartUrl,
          icons: [
            {
              src: `${basePath}pwa-192x192.png`,
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: `${basePath}pwa-512x512.png`,
              sizes: '512x512',
              type: 'image/png',
            },
          ],
        },
        workbox: {
          navigateFallback: `${basePath}index.html`,
          manifestTransforms: [
            (manifestEntries) => {
              const eagerAssetUrls = loadEagerAssetUrls(manifestPath)
              const staticShellUrls = new Set([
                'index.html',
                'manifest.webmanifest',
                'registerSW.js',
                'favicon.svg',
                'icons.svg',
              ])

              return {
                manifest: manifestEntries.filter((entry) => {
                  const path = stripBasePath(entry.url, basePath)
                  return staticShellUrls.has(path) || isPrecacheUrl(entry.url, basePath, eagerAssetUrls)
                }),
                warnings: [],
              }
            },
          ],
          runtimeCaching: [
            {
              urlPattern: assetFilePattern,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'deferred-route-assets',
                expiration: {
                  maxEntries: 32,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
              },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': '/src',
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test-setup.ts'],
    },
  }
})
