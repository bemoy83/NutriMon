/**
 * Shared visual accents for the three combat form stats (strength / resilience / momentum).
 * Keep in sync with battle RPC semantics where relevant.
 */
export const creatureStatBarFill = {
  strength: 'var(--app-coral)',
  resilience: 'var(--app-resilience)',
  momentum: 'var(--app-warning)',
} as const

export type CreatureStatAccent = keyof typeof creatureStatBarFill

/** Tailwind arbitrary bg classes matching `creatureStatBarFill` */
export const creatureStatAccentBgClass = {
  strength: 'bg-[var(--app-coral)]',
  resilience: 'bg-[var(--app-resilience)]',
  momentum: 'bg-[var(--app-warning)]',
} as const
