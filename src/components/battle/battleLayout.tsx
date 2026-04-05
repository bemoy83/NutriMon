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

/** Frosted strip over arena bottom; backdrop samples terrain */
export const battleCommandBarSurfaceClass =
  'absolute bottom-0 left-0 right-0 z-30 flex h-[var(--battle-cmd-h)] shrink-0 border-t border-white/10 bg-[rgb(15_23_42/0.72)] shadow-sm backdrop-blur-md backdrop-saturate-150'
