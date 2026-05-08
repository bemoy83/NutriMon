import { creatureStatAccentBgClass } from '@/lib/creatureStatAccents'
import type { BattleAction } from '@/types/domain'

export const BATTLE_ACTION_LABELS = ['Attack', 'Defend', 'Focus', 'Skill'] as const
export type BattleActionLabel = (typeof BATTLE_ACTION_LABELS)[number]

export const battleActionToPayload: Record<BattleActionLabel, BattleAction> = {
  Attack: 'attack',
  Defend: 'defend',
  Focus:  'focus',
  Skill:  'skill',
}

// Skill ID fired when the player selects the Skill action.
// Hardcoded to triple_hit while only one skill exists; extend to a skill picker
// when the companion has multiple unlocked skills.
export const BATTLE_SKILL_ID = 'triple_hit'

// Pip cost for each skill — mirrors the server-side constants in migration 055.
export const BATTLE_SKILL_PIP_COST: Record<string, number> = {
  triple_hit: 1,
}

export const battleActionSubLabel: Record<BattleActionLabel, string> = {
  Attack: 'Full power',
  Defend: 'Halve damage',
  Focus:  '+1 focus pip',
  Skill:  'Triple Hit',
}

/** Shared press/hover feedback for all command buttons (no brand tint). */
export const battleActionButtonHoverClass =
  'hover:brightness-95 active:brightness-90'

/** Solid filled — kept for non-battle contexts (e.g. hub cards). */
export const battleActionButtonClass: Record<BattleActionLabel, string> = {
  Attack: `${creatureStatAccentBgClass.strength} text-white`,
  Defend: `${creatureStatAccentBgClass.resilience} text-white`,
  Focus:  `${creatureStatAccentBgClass.momentum} text-slate-900`,
  Skill:  'bg-violet-500 text-white',
}

/** Ghost style for in-battle command buttons: subtle tint bg + colored border + colored label text. */
export const battleActionGhostColors: Record<
  BattleActionLabel,
  { bg: string; border: string; text: string }
> = {
  Attack: { bg: 'rgba(232,106,92,0.10)',  border: 'rgba(232,106,92,0.35)',  text: 'var(--app-coral)'      },
  Defend: { bg: 'rgba(14,165,233,0.10)',  border: 'rgba(14,165,233,0.35)',  text: 'var(--app-resilience)' },
  Focus:  { bg: 'rgba(245,158,11,0.10)',  border: 'rgba(245,158,11,0.35)',  text: 'var(--app-warning)'    },
  Skill:  { bg: 'rgba(139,92,246,0.12)',  border: 'rgba(139,92,246,0.40)',  text: 'rgb(167,139,250)'      },
}
