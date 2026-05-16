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

export const BATTLE_SKILL_PIP_COST: Record<string, number> = Object.fromEntries(
  BATTLE_SKILL_CATALOG.map((skill) => [skill.id, skill.pipCost]),
)

export function getBattleSkill(skillId: string | null | undefined): BattleSkillDef | null {
  if (!skillId) return null
  return BATTLE_SKILL_CATALOG.find((skill) => skill.id === skillId) ?? null
}

export function getBattleSkillPipCost(skillId: string | null | undefined): number {
  return getBattleSkill(skillId)?.pipCost ?? 1
}

export function doesBattleSkillSpendAllPips(skillId: string | null | undefined): boolean {
  return getBattleSkill(skillId)?.allPips === true
}
