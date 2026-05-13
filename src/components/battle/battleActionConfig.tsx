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

export interface BattleSkillDef {
  id: string
  label: string
  description: string
  kind: 'attack' | 'heal' | 'buff'
  pipCost: number
  allPips?: true
  unlockLevel: number
  icon: string
}

export const BATTLE_SKILL_CATALOG: BattleSkillDef[] = [
  {
    id: 'triple_hit',
    label: 'Triple Hit',
    description: '3 hits at 75% power each',
    kind: 'attack',
    pipCost: 1,
    unlockLevel: 1,
    icon: '⚔️',
  },
  {
    id: 'power_strike',
    label: 'Power Strike',
    description: '1 hit at 200% power',
    kind: 'attack',
    pipCost: 1,
    unlockLevel: 4,
    icon: '💥',
  },
  {
    id: 'regen',
    label: 'Regen',
    description: 'Restore 30% of max HP',
    kind: 'heal',
    pipCost: 2,
    unlockLevel: 8,
    icon: '💚',
  },
  {
    id: 'charge_strike',
    label: 'Charge Strike',
    description: 'Spend all pips — pips × 120% power (min 2)',
    kind: 'attack',
    pipCost: 2,
    allPips: true,
    unlockLevel: 15,
    icon: '⚡',
  },
  {
    id: 'counter_stance',
    label: 'Counter Stance',
    description: '50% damage reduction + 80% counter if attacked',
    kind: 'buff',
    pipCost: 1,
    unlockLevel: 18,
    icon: '🛡️',
  },
  {
    id: 'overdrive',
    label: 'Overdrive',
    description: '5 hits at 60% power each',
    kind: 'attack',
    pipCost: 3,
    unlockLevel: 20,
    icon: '🌀',
  },
]

export const battleActionFromPayload: Record<BattleAction, BattleActionLabel> = {
  attack: 'Attack',
  defend: 'Defend',
  focus:  'Focus',
  skill:  'Skill',
}

// Derived from the catalog — single source of truth for pip costs.
export const BATTLE_SKILL_PIP_COST: Record<string, number> = Object.fromEntries(
  BATTLE_SKILL_CATALOG.map(s => [s.id, s.pipCost]),
)

export const battleActionIcon: Record<BattleActionLabel, string> = {
  Attack: '⚔️',
  Defend: '🛡️',
  Focus:  '✨',
  Skill:  '💥',
}

export const battleActionSubLabel: Record<BattleActionLabel, string> = {
  Attack: 'Full power',
  Defend: 'Halve damage',
  Focus:  '+1 focus pip',
  Skill:  'Choose…',
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
