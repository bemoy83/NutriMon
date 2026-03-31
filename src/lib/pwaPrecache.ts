export interface ManifestChunk {
  file: string
  css?: string[]
  assets?: string[]
  imports?: string[]
  dynamicImports?: string[]
  isEntry?: boolean
}

export type BuildManifest = Record<string, ManifestChunk>

export function stripBasePath(url: string, basePath: string): string {
  const normalizedUrl = url.startsWith('/') ? url.slice(1) : url
  const normalizedBase = basePath === '/' ? '' : basePath.replace(/^\/|\/$/g, '')

  if (normalizedBase && normalizedUrl.startsWith(`${normalizedBase}/`)) {
    return normalizedUrl.slice(normalizedBase.length + 1)
  }

  return normalizedUrl
}

export function collectEagerAssetUrls(manifest: BuildManifest, entryKey: string): Set<string> {
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
