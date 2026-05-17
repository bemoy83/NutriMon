import { describe, expect, it } from 'vitest'
import {
  getCondition,
  getFinalizationXp,
  getLikelyOutcome,
  getLevelFromXp,
  getReadinessBand,
  getReadinessScore,
  getUnlockedStage,
  resolveBattle,
} from '../../../supabase/functions/_shared/battleSystem.ts'

describe('battleSystem', () => {
  it('derives progression milestones and readiness bands', () => {
    expect(getUnlockedStage(0)).toBe('baby')
    expect(getUnlockedStage(7)).toBe('adult')
    expect(getUnlockedStage(30)).toBe('champion')
    expect(getLevelFromXp(0)).toBe(1)
    expect(getLevelFromXp(250)).toBe(7)
    expect(getReadinessBand(getReadinessScore({ strength: 82, resilience: 76, momentum: 74, vitality: 108 }))).toBe('building')
  })

  it('keeps condition supportive and awards nutrition xp from meal and adherence signals', () => {
    expect(
      getCondition({
        hasMeals: false,
        adjustedAdherence: 0,
        currentStreak: 0,
        readinessScore: 20,
      }),
    ).toBe('recovering')

    expect(
      getCondition({
        hasMeals: true,
        adjustedAdherence: 92,
        currentStreak: 4,
        readinessScore: 91,
      }),
    ).toBe('thriving')

    expect(getFinalizationXp(68, 'poor')).toBe(40)
    expect(getFinalizationXp(92, 'optimal')).toBe(70)
    expect(getFinalizationXp(92, 'no_data')).toBe(0)
  })

  it('resolves battles deterministically from locked stats and seed input', () => {
    const snapshot = {
      strength: 78,
      resilience: 74,
      momentum: 80,
      vitality: 108,
      level: 4,
      stage: 'adult' as const,
    }
    const opponent = {
      recommendedLevel: 3,
      strength: 60,
      resilience: 58,
      momentum: 64,
      vitality: 92,
    }

    expect(getLikelyOutcome(snapshot, opponent)).toBe('favored')

    const first = resolveBattle(snapshot, opponent, 'snapshot-1:opp-1')
    const second = resolveBattle(snapshot, opponent, 'snapshot-1:opp-1')

    expect(first).toEqual(second)
    expect(first.outcome).toBe('win')
    expect(first.turnCount).toBeGreaterThanOrEqual(3)
    expect(first.remainingHpPct).toBeGreaterThanOrEqual(8)
  })

  it('keeps retuned opponent levels paced below level 20 without rematches and at level 20 with engagement', () => {
    const tunedOpponentLevels = [
      3, 4, 5, 6, 7,
      7, 8, 9, 10, 11,
      10, 11, 12, 14, 15,
      14, 15, 16, 18, 19,
      16, 17, 18, 19, 20,
    ]
    const perfectDailyXp = 70
    const battleXp = (opponentLevel: number) => 10 + opponentLevel * 4
    const highestDistinctLevels = (levels: number[], count: number) => [...levels].sort((a, b) => b - a).slice(0, count)
    const xpForFirstNodes = (nodeCount: number) => tunedOpponentLevels
      .slice(0, nodeCount)
      .reduce((sum, opponentLevel) => sum + perfectDailyXp + battleXp(opponentLevel), 0)
    const xpWithRematchesBeforeFinalBoss = tunedOpponentLevels
      .slice(0, 24)
      .reduce((sum, opponentLevel, index, clearedLevels) => {
        const rematchXp = highestDistinctLevels(clearedLevels.slice(0, index + 1), 3)
          .reduce((rematchSum, rematchLevel) => rematchSum + battleXp(rematchLevel), 0)
        return sum + perfectDailyXp + battleXp(opponentLevel) + rematchXp
      }, 0)

    expect(getLevelFromXp(xpForFirstNodes(25))).toBe(15)
    expect(getLevelFromXp(xpWithRematchesBeforeFinalBoss)).toBe(20)
  })
})
