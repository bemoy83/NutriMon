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
export const battleActionSubLabel: Record<BattleActionLabel, string> = {
  Attack: 'Full power',
  Defend: 'Halve damage',
  Focus:  '+60% next hit',
}

/** Shared press/hover feedback for all command buttons (no brand tint). */
export const battleActionButtonHoverClass =
  'hover:brightness-95 active:brightness-90'

/** Solid filled — kept for non-battle contexts (e.g. hub cards). */
export const battleActionButtonClass: Record<BattleActionLabel, string> = {
  Attack: `${creatureStatAccentBgClass.strength} text-white`,
  Defend: `${creatureStatAccentBgClass.resilience} text-white`,
  Focus: `${creatureStatAccentBgClass.momentum} text-slate-900`,
}

/** Ghost style for in-battle command buttons: subtle tint bg + colored border + colored label text. */
export const battleActionGhostColors: Record<
  BattleActionLabel,
  { bg: string; border: string; text: string }
> = {
  Attack: { bg: 'rgba(232,106,92,0.10)',  border: 'rgba(232,106,92,0.35)',  text: 'var(--app-coral)'       },
  Defend: { bg: 'rgba(14,165,233,0.10)',  border: 'rgba(14,165,233,0.35)',  text: 'var(--app-resilience)'  },
  Focus:  { bg: 'rgba(245,158,11,0.10)',  border: 'rgba(245,158,11,0.35)',  text: 'var(--app-warning)'     },
}
