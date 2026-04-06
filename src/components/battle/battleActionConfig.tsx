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
/** Shared press/hover feedback for all command buttons (no brand tint). */
export const battleActionButtonHoverClass =
  'hover:brightness-95 active:brightness-90'

export const battleActionButtonClass: Record<BattleActionLabel, string> = {
  Attack: `${creatureStatAccentBgClass.strength} text-white`,
  Defend: `${creatureStatAccentBgClass.resilience} text-white`,
  Focus: `${creatureStatAccentBgClass.momentum} text-slate-900`,
}
