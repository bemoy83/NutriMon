import { creatureStatAccentBgClass } from '@/lib/creatureStatAccents'
import type { BattleAction } from '@/types/domain'

export const BATTLE_ACTION_LABELS = ['Attack', 'Defend', 'Focus'] as const
export type BattleActionLabel = (typeof BATTLE_ACTION_LABELS)[number]

export const battleActionToPayload: Record<BattleActionLabel, BattleAction> = {
  Attack: 'attack',
  Defend: 'defend',
  Focus: 'focus',
}

// Maps UI actions to stat accent colors (see creatureStatAccents + battle RPC):
// Attack — strength-led damage; momentum also affects damage/crit.
// Defend — player resilience scales blocked damage.
// Focus — momentum_boost + initiative.
export const battleActionButtonClass: Record<
  BattleActionLabel,
  { enabled: string; hover: string }
> = {
  Attack: {
    enabled: `${creatureStatAccentBgClass.strength} text-white`,
    hover: 'hover:brightness-95 active:brightness-90',
  },
  Defend: {
    enabled: `${creatureStatAccentBgClass.resilience} text-white`,
    hover: 'hover:bg-[var(--app-brand-hover)]',
  },
  Focus: {
    enabled: `${creatureStatAccentBgClass.momentum} text-slate-900`,
    hover: 'hover:brightness-95 active:brightness-90',
  },
}
