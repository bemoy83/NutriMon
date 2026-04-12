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
// Attack — deal full damage now.
// Defend — halve incoming damage this turn; no carry-over effect.
// Focus  — Focused Attack: 75% damage now + 60% bonus next hit, but you take 1.3× incoming this round.
/** Shared press/hover feedback for all command buttons (no brand tint). */
export const battleActionButtonHoverClass =
  'hover:brightness-95 active:brightness-90'

export const battleActionButtonClass: Record<BattleActionLabel, string> = {
  Attack: `${creatureStatAccentBgClass.strength} text-white`,
  Defend: `${creatureStatAccentBgClass.resilience} text-white`,
  Focus: `${creatureStatAccentBgClass.momentum} text-slate-900`,
}
