export interface ManifestChunk {
  file: string
  css?: string[]
  assets?: string[]
  imports?: string[]
  dynamicImports?: string[]
  isEntry?: boolean
}

export type BuildManifest = Record<string, ManifestChunk>

export interface CollectPrecacheOptions {
  /** When true, follows `dynamicImports` so lazy route chunks are precached (cold PWA launch). */
  includeDynamicImports?: boolean
}

export function stripBasePath(url: string, basePath: string): string {
  const normalizedUrl = url.startsWith('/') ? url.slice(1) : url
  const normalizedBase = basePath === '/' ? '' : basePath.replace(/^\/|\/$/g, '')

  if (normalizedBase && normalizedUrl.startsWith(`${normalizedBase}/`)) {
    return normalizedUrl.slice(normalizedBase.length + 1)
  }

  return normalizedUrl
}

/**
 * Collects output asset paths (JS, CSS, chunk assets) reachable from the entry chunk.
 * Optionally includes Vite `dynamicImports` (lazy routes) and their nested graphs.
 */
export function collectPrecacheAssetUrls(
  manifest: BuildManifest,
  entryKey: string,
  options: CollectPrecacheOptions = {},
): Set<string> {
  const { includeDynamicImports = false } = options
  const urls = new Set<string>()
  const visited = new Set<string>()

  function visitChunk(chunkKey: string) {
    if (visited.has(chunkKey)) return
    visited.add(chunkKey)

    const chunk = manifest[chunkKey]
    if (!chunk) return

    urls.add(chunk.file)
    chunk.css?.forEach((cssFile) => urls.add(cssFile))
    chunk.assets?.forEach((assetFile) => urls.add(assetFile))
    chunk.imports?.forEach((importKey) => visitChunk(importKey))
    if (includeDynamicImports) {
      chunk.dynamicImports?.forEach((importKey) => visitChunk(importKey))
    }
  }

  visitChunk(entryKey)
  return urls
}

/** Static import graph only (same as `collectPrecacheAssetUrls` without dynamic imports). */
export function collectEagerAssetUrls(manifest: BuildManifest, entryKey: string): Set<string> {
  return collectPrecacheAssetUrls(manifest, entryKey, { includeDynamicImports: false })
}

export function filterPrecacheEntries<T extends { url: string }>(
  manifestEntries: T[],
  basePath: string,
  eagerAssetUrls: Set<string>,
  staticShellUrls: Set<string>,
): T[] {
  return manifestEntries.filter((entry) => {
    const path = stripBasePath(entry.url, basePath)
    return staticShellUrls.has(path) || eagerAssetUrls.has(path)
  })
}
