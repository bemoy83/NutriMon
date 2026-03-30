export type RouterMode = 'browser' | 'hash'

export function normalizeBasePath(value?: string | null): string {
  const trimmed = (value ?? '/').trim()
  if (!trimmed || trimmed === '/') return '/'

  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`
}

export function getRouterMode(): RouterMode {
  return import.meta.env.VITE_ROUTER_MODE === 'hash' ? 'hash' : 'browser'
}

export function getAppBasePath(): string {
  const baseUrl = import.meta.env.BASE_URL as string | undefined
  return normalizeBasePath(baseUrl)
}

export function getRouterBasename(): string {
  return getRouterMode() === 'hash' ? '/' : getAppBasePath()
}

export function getExternalAppUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const basePath = getAppBasePath()
  const origin = window.location.origin

  if (getRouterMode() === 'hash') {
    return `${origin}${basePath}#${normalizedPath}`
  }

  if (basePath === '/') {
    return `${origin}${normalizedPath}`
  }

  return `${origin}${basePath}${normalizedPath.slice(1)}`
}
