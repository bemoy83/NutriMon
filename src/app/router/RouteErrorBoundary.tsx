import { isRouteErrorResponse, useRouteError } from 'react-router-dom'

function messageFromUnknown(err: unknown): string {
  if (isRouteErrorResponse(err)) {
    return typeof err.data === 'string' ? err.data : err.statusText || `Error ${err.status}`
  }
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  try {
    return JSON.stringify(err)
  } catch {
    return 'Unknown error'
  }
}

function isChunkOrModuleLoadFailure(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes('importing a module script failed')
    || m.includes('failed to fetch dynamically imported module')
    || m.includes('chunkloaderror')
    || m.includes('loading chunk')
    || m.includes('error loading dynamically imported module')
  )
}

export default function RouteErrorBoundary() {
  const error = useRouteError()
  const message = messageFromUnknown(error)
  const isChunk = isChunkOrModuleLoadFailure(message)
  if (import.meta.env.DEV) {
    console.error('[RouteErrorBoundary]', error)
  }

  return (
    <div
      className="app-page flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center"
      style={{ background: 'var(--app-bg)', color: 'var(--app-text-primary)' }}
    >
      <h1 className="text-lg font-semibold">
        {isChunk ? 'App update' : 'Something went wrong'}
      </h1>
      <p className="max-w-sm text-sm" style={{ color: 'var(--app-text-muted)' }}>
        {isChunk
          ? 'A new version may be available, or the connection dropped while loading the app. Reload to try again.'
          : 'An unexpected error occurred. You can try reloading the app.'}
      </p>
      <button
        type="button"
        className="app-button-primary rounded-[var(--app-radius-lg)] px-5 py-2.5 text-sm font-medium"
        onClick={() => {
          window.location.reload()
        }}
      >
        Reload app
      </button>
    </div>
  )
}
