import type { CSSProperties } from 'react'

/** Must match gameplay inset `bottom-[var(--battle-cmd-h)]` and command bar height. */
export const BATTLE_COMMAND_BAR_HEIGHT = '11rem'

const CMD_VAR = '--battle-cmd-h' as const

/** Merge onto arena `style` next to `background`. */
export function battleArenaCmdBarVars(): CSSProperties {
  return { [CMD_VAR]: BATTLE_COMMAND_BAR_HEIGHT } as CSSProperties
}

/** Gameplay band above the overlay command bar */
export const battleGameplayBandClass = 'absolute inset-x-0 top-0 bottom-[var(--battle-cmd-h)]'

/** Solid dark panel at arena bottom */
export const battleCommandBarSurfaceClass =
  'absolute bottom-0 left-0 right-0 z-30 flex h-[var(--battle-cmd-h)] shrink-0 gap-3 border-t border-white/[0.06] bg-[#0f1018] p-3'
