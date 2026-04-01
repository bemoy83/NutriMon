export const QUALIFYING_STREAK_DAYS_FOR_ADULT = 7
export const QUALIFYING_STREAK_DAYS_FOR_CHAMPION = 30
export const DEFAULT_COMPANION_NAME = 'Sprout'
export const XP_PER_LEVEL = 100

export type CreatureStage = 'baby' | 'adult' | 'champion'
export type CreatureCondition = 'thriving' | 'steady' | 'recovering' | 'quiet'
export type ReadinessBand = 'recovering' | 'building' | 'ready' | 'peak'
export type BattleLikelyOutcome = 'favored' | 'competitive' | 'risky'

export interface CreatureCombatStats {
  strength: number
  resilience: number
  momentum: number
  vitality: number
  level: number
  stage: CreatureStage
}

export interface CreatureConditionInput {
  hasMeals: boolean
  adjustedAdherence: number
  currentStreak: number
  daysLoggedLast7: number
  readinessScore: number
}

export interface OpponentCombatProfile {
  recommendedLevel: number
  strength: number
  resilience: number
  momentum: number
  vitality: number
}

export interface BattleResolution {
  outcome: 'win' | 'loss'
  turnCount: number
  remainingHpPct: number
  playerPower: number
  opponentPower: number
  margin: number
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function getUnlockedStage(longestStreak: number): CreatureStage {
  if (longestStreak >= QUALIFYING_STREAK_DAYS_FOR_CHAMPION) return 'champion'
  if (longestStreak >= QUALIFYING_STREAK_DAYS_FOR_ADULT) return 'adult'
  return 'baby'
}

export function stageRank(stage: CreatureStage): number {
  if (stage === 'champion') return 3
  if (stage === 'adult') return 2
  return 1
}

export function getHigherStage(current: CreatureStage, next: CreatureStage): CreatureStage {
  return stageRank(current) >= stageRank(next) ? current : next
}

export function getLevelFromXp(xp: number): number {
  return Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1
}

export function getReadinessScore(stats: Pick<CreatureCombatStats, 'strength' | 'resilience' | 'momentum' | 'vitality'>): number {
  const normalizedVitality = clamp(stats.vitality - 50, 0, 100)
  return Math.round(
    stats.strength * 0.3 +
      stats.resilience * 0.2 +
      stats.momentum * 0.2 +
      normalizedVitality * 0.3,
  )
}

export function getReadinessBand(score: number): ReadinessBand {
  if (score >= 90) return 'peak'
  if (score >= 75) return 'ready'
  if (score >= 50) return 'building'
  return 'recovering'
}

export function getCondition(input: CreatureConditionInput): CreatureCondition {
  if (!input.hasMeals || input.daysLoggedLast7 <= 1) return 'quiet'
  if (input.readinessScore >= 88 && input.adjustedAdherence >= 85 && input.currentStreak >= 3) return 'thriving'
  if (input.adjustedAdherence < 70 || input.readinessScore < 50) return 'recovering'
  return 'steady'
}

export function getFinalizationXp(adjustedAdherence: number, status: string, currentStreak: number): number {
  if (status === 'no_data' || adjustedAdherence < 70) return 0
  return 15 + Math.min(currentStreak, 10) + (adjustedAdherence >= 90 ? 5 : 0)
}

export function getStageBonus(stage: CreatureStage): number {
  if (stage === 'champion') return 12
  if (stage === 'adult') return 6
  return 0
}

export function getSnapshotPower(stats: CreatureCombatStats): number {
  return Math.round(
    stats.strength * 0.32 +
      stats.resilience * 0.22 +
      stats.momentum * 0.18 +
      clamp(stats.vitality - 50, 0, 100) * 0.28 +
      stats.level * 2 +
      getStageBonus(stats.stage),
  )
}

export function getOpponentPower(opponent: OpponentCombatProfile): number {
  return Math.round(
    opponent.strength * 0.34 +
      opponent.resilience * 0.22 +
      opponent.momentum * 0.18 +
      clamp(opponent.vitality - 50, 0, 100) * 0.26 +
      opponent.recommendedLevel * 2,
  )
}

export function getLikelyOutcome(stats: CreatureCombatStats, opponent: OpponentCombatProfile): BattleLikelyOutcome {
  const diff = getSnapshotPower(stats) - getOpponentPower(opponent)
  if (diff >= 8) return 'favored'
  if (diff >= -6) return 'competitive'
  return 'risky'
}

function hashSeed(input: string): number {
  let hash = 0
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0
  }
  return hash
}

export function resolveBattle(
  stats: CreatureCombatStats,
  opponent: OpponentCombatProfile,
  seedInput: string,
): BattleResolution {
  const playerPower = getSnapshotPower(stats)
  const opponentPower = getOpponentPower(opponent)
  const seedA = hashSeed(`${seedInput}:player`)
  const seedB = hashSeed(`${seedInput}:opponent`)
  const seedC = hashSeed(`${seedInput}:turns`)
  const playerVariance = (seedA % 11) - 5
  const opponentVariance = (seedB % 11) - 5
  const margin = playerPower + playerVariance - (opponentPower + opponentVariance)
  const outcome = margin >= 0 ? 'win' : 'loss'
  const turnCount = 3 + (seedC % 4)
  const remainingHpPct =
    outcome === 'win'
      ? clamp(35 + margin * 3, 8, 100)
      : clamp(24 + margin * 2, 0, 45)

  return {
    outcome,
    turnCount,
    remainingHpPct,
    playerPower,
    opponentPower,
    margin,
  }
}
