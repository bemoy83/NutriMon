export const CRON_AUTH_HEADER = 'x-cron-secret'

export function getCronAuthError(headers: Headers, expectedSecret: string | null | undefined): string | null {
  if (!expectedSecret) {
    return 'CRON_SHARED_SECRET not configured'
  }

  const providedSecret = headers.get(CRON_AUTH_HEADER)
  if (!providedSecret) {
    return 'Missing cron secret'
  }

  if (providedSecret !== expectedSecret) {
    return 'Invalid cron secret'
  }

  return null
}
