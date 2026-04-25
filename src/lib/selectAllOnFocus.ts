import type { FocusEvent } from 'react'

/** Select entire field on focus so typing replaces the value (avoids e.g. appending to 0). */
export function selectAllOnFocus(e: FocusEvent<HTMLInputElement>) {
  const el = e.currentTarget
  requestAnimationFrame(() => {
    el.select()
  })
}
