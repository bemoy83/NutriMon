/**
 * User-facing copy for fetch failures. Supabase normally returns `{ error }` for HTTP/API
 * errors; when `fetch` never completes successfully, browsers (especially Safari / iOS) throw
 * `TypeError` with messages like "Load failed" or "Failed to fetch".
 */
export function userMessageForFailedRequest(err: unknown): string {
  if (!(err instanceof Error)) {
    return 'Could not reach the server. Check your connection and try again.'
  }
  const m = err.message
  const lower = m.toLowerCase()
  if (
    m === 'Load failed'
    || lower.includes('load failed')
    || lower.includes('failed to fetch')
    || lower.includes('networkerror')
    || lower.includes('network request failed')
    || lower.includes('the internet connection appears to be offline')
  ) {
    return 'Could not reach the server. Check your connection and try again.'
  }
  return m
}
