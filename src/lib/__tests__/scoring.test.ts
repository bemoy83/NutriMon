import { describe, it, expect } from 'vitest'
import {
  calculateAdherenceScore,
  calculateAdjustedAdherence,
  classifyStatus,
  calculateNoDataAdjustedAdherence,
  calculateHabitMetrics,
  calculateBehaviorAttributes,
  calculateCreatureStats,
  getFeedbackMessage,
} from '../scoring'
import type { DailyEvaluation } from '@/types/domain'

// §17 Seed Evaluation Scenarios
describe('calculateAdherenceScore', () => {
  it('Scenario A: target 2000, consumed 1900 → adherence 100', () => {
    expect(calculateAdherenceScore(1900, 2000)).toBe(100)
  })

  it('Scenario B: target 2000, consumed 2100 → adherence 90', () => {
    expect(calculateAdherenceScore(2100, 2000)).toBe(90)
  })

  it('Scenario C: target 2000, consumed 2300 → adherence 70', () => {
    expect(calculateAdherenceScore(2300, 2000)).toBe(70)
  })

  it('Scenario D: target 2000, consumed 2600 → adherence 40', () => {
    expect(calculateAdherenceScore(2600, 2000)).toBe(40)
  })

  it('Scenario E: target 2000, consumed 1400 → adherence 100', () => {
    expect(calculateAdherenceScore(1400, 2000)).toBe(100)
  })

  it('consumed 0 → adherence 0', () => {
    expect(calculateAdherenceScore(0, 2000)).toBe(0)
  })

  it('consumed exactly at target → adherence 100', () => {
    expect(calculateAdherenceScore(2000, 2000)).toBe(100)
  })

  it('delta > 500 clamps to 0', () => {
    // delta = 1000, score = 50 - (500 * 0.1) = 0
    expect(calculateAdherenceScore(3000, 2000)).toBe(0)
  })
})

describe('calculateAdjustedAdherence', () => {
  it('Scenario A: delta -100 → adjusted 100', () => {
    expect(calculateAdjustedAdherence(100, -100)).toBe(100)
  })

  it('Scenario B: delta 100 → adjusted 90 (no penalty)', () => {
    expect(calculateAdjustedAdherence(90, 100)).toBe(90)
  })

  it('Scenario C: delta 300 → adjusted 70', () => {
    expect(calculateAdjustedAdherence(70, 300)).toBe(70)
  })

  it('Scenario D: delta 600 → adjusted 40', () => {
    expect(calculateAdjustedAdherence(40, 600)).toBe(40)
  })

  it('Scenario E: delta -600 → adjusted 90 (penalty for extreme undereating)', () => {
    // adherence=100, delta=-600: adjusted = 100 - abs(-600+500)*0.1 = 100 - 10 = 90
    expect(calculateAdjustedAdherence(100, -600)).toBe(90)
  })

  it('extreme undereating clamps to 0', () => {
    // adherence=100, delta=-1500: penalty = abs(-1500+500)*0.1 = 100, adjusted = 0
    expect(calculateAdjustedAdherence(100, -1500)).toBe(0)
  })
})

describe('classifyStatus', () => {
  it('no meals → no_data', () => {
    expect(classifyStatus(100, false)).toBe('no_data')
  })

  it('adjusted >= 90 → optimal', () => {
    expect(classifyStatus(95, true)).toBe('optimal')
    expect(classifyStatus(90, true)).toBe('optimal')
  })

  it('70 <= adjusted < 90 → acceptable', () => {
    expect(classifyStatus(75, true)).toBe('acceptable')
    expect(classifyStatus(70, true)).toBe('acceptable')
  })

  it('adjusted < 70 → poor', () => {
    expect(classifyStatus(65, true)).toBe('poor')
    expect(classifyStatus(0, true)).toBe('poor')
  })
})

describe('calculateNoDataAdjustedAdherence', () => {
  it('decays by 10% from previous value', () => {
    expect(calculateNoDataAdjustedAdherence(80)).toBe(72)
  })

  it('uses 0 if no previous value', () => {
    expect(calculateNoDataAdjustedAdherence(null)).toBe(0)
  })
})

// Helper to build a minimal eval
function makeEval(
  logDate: string,
  adjustedAdherence: number,
  consumedCalories = 1800,
): Pick<DailyEvaluation, 'logDate' | 'status' | 'adjustedAdherence' | 'consumedCalories'> {
  const status =
    consumedCalories === 0
      ? 'no_data'
      : adjustedAdherence >= 90
        ? 'optimal'
        : adjustedAdherence >= 70
          ? 'acceptable'
          : 'poor'
  return { logDate, adjustedAdherence, status, consumedCalories }
}

describe('calculateHabitMetrics', () => {
  it('increments streak when qualifying day follows qualifying day on consecutive date', () => {
    const prev = { currentStreak: 3, longestStreak: 5, lastLogDate: '2026-01-04', logDate: '2026-01-04' }
    const current = makeEval('2026-01-05', 90)
    const result = calculateHabitMetrics(prev, current, [current])
    expect(result.currentStreak).toBe(4)
  })

  it('resets streak to 1 on qualifying day after gap', () => {
    const prev = { currentStreak: 3, longestStreak: 5, lastLogDate: '2026-01-01', logDate: '2026-01-01' }
    const current = makeEval('2026-01-05', 90)
    const result = calculateHabitMetrics(prev, current, [current])
    expect(result.currentStreak).toBe(1)
  })

  it('resets streak to 0 on no_data day', () => {
    const prev = { currentStreak: 3, longestStreak: 5, lastLogDate: '2026-01-04', logDate: '2026-01-04' }
    const current = makeEval('2026-01-05', 0, 0)
    const result = calculateHabitMetrics(prev, current, [current])
    expect(result.currentStreak).toBe(0)
  })

  it('preserves longest_streak when current is shorter', () => {
    const prev = { currentStreak: 1, longestStreak: 10, lastLogDate: '2026-01-04', logDate: '2026-01-04' }
    const current = makeEval('2026-01-05', 90)
    const result = calculateHabitMetrics(prev, current, [current])
    expect(result.longestStreak).toBe(10)
  })

  it('updates longest_streak when current exceeds it', () => {
    const prev = { currentStreak: 9, longestStreak: 9, lastLogDate: '2026-01-04', logDate: '2026-01-04' }
    const current = makeEval('2026-01-05', 90)
    const result = calculateHabitMetrics(prev, current, [current])
    expect(result.longestStreak).toBe(10)
  })

  it('counts days_logged_last_7 correctly', () => {
    const evals = [
      makeEval('2026-01-05', 90, 1800),
      makeEval('2026-01-04', 90, 1800),
      makeEval('2026-01-03', 90, 0), // no meals
      makeEval('2026-01-02', 90, 1800),
    ]
    const result = calculateHabitMetrics(null, evals[0], evals)
    expect(result.daysLoggedLast7).toBe(3)
  })
})

describe('calculateBehaviorAttributes', () => {
  const makeMinimalEval = (adj: number, date: string) => ({
    logDate: date,
    adjustedAdherence: adj,
    status: adj >= 90 ? ('optimal' as const) : adj >= 70 ? ('acceptable' as const) : ('poor' as const),
  })

  it('calculates consistency as avg of last 7', () => {
    const evals = [100, 80, 90, 70, 85, 95, 60].map((adj, i) =>
      makeMinimalEval(adj, `2026-01-0${7 - i}`),
    )
    const result = calculateBehaviorAttributes(evals, '2026-01-07')
    const expectedAvg = (100 + 80 + 90 + 70 + 85 + 95 + 60) / 7
    expect(result.consistencyScore).toBeCloseTo(expectedAvg, 1)
  })

  it('calculates momentum as avg of last 3', () => {
    const evals = [100, 80, 90, 70, 85, 95, 60].map((adj, i) =>
      makeMinimalEval(adj, `2026-01-0${7 - i}`),
    )
    const result = calculateBehaviorAttributes(evals, '2026-01-07')
    const expected = (100 + 80 + 90) / 3
    expect(result.momentumScore).toBeCloseTo(expected, 1)
  })

  it('discipline_score denominator is always 7 even with partial history', () => {
    const evals = [makeMinimalEval(90, '2026-01-03'), makeMinimalEval(85, '2026-01-02')]
    const result = calculateBehaviorAttributes(evals, '2026-01-03')
    // 2 qualifying days / 7
    expect(result.disciplineScore).toBeCloseTo((2 / 7) * 100, 1)
  })

  it('stability clamps to minimum 20', () => {
    // All values same → stddev = 0 → stability = 100 (above floor)
    const evals = Array.from({ length: 7 }, (_, i) => makeMinimalEval(80, `2026-01-0${i + 1}`))
    const result = calculateBehaviorAttributes(evals, '2026-01-07')
    expect(result.stabilityScore).toBe(100)
  })
})

describe('calculateCreatureStats', () => {
  it('maps consistency to strength', () => {
    const attrs = { consistencyScore: 82.5, stabilityScore: 74, momentumScore: 88 }
    const stats = calculateCreatureStats(attrs, 4, '2026-01-05')
    expect(stats.strength).toBe(83) // round(82.5)
  })

  it('calculates vitality as 50 + streak * 5', () => {
    const attrs = { consistencyScore: 80, stabilityScore: 70, momentumScore: 85 }
    const stats = calculateCreatureStats(attrs, 4, '2026-01-05')
    expect(stats.vitality).toBe(70) // 50 + 4*5
  })

  it('stage is always baby in Phase 1', () => {
    const attrs = { consistencyScore: 100, stabilityScore: 100, momentumScore: 100 }
    const stats = calculateCreatureStats(attrs, 30, '2026-01-05')
    expect(stats.stage).toBe('baby')
  })

  it('clamps stats to 0-100', () => {
    const attrs = { consistencyScore: 150, stabilityScore: -10, momentumScore: 200 }
    const stats = calculateCreatureStats(attrs, 0, '2026-01-05')
    expect(stats.strength).toBe(100)
    expect(stats.resilience).toBe(0)
    expect(stats.momentum).toBe(100)
  })

  it('clamps vitality to minimum 50', () => {
    const attrs = { consistencyScore: 80, stabilityScore: 70, momentumScore: 85 }
    const stats = calculateCreatureStats(attrs, 0, '2026-01-05')
    expect(stats.vitality).toBe(50)
  })
})

describe('getFeedbackMessage', () => {
  it('returns optimal message', () => {
    const { message } = getFeedbackMessage('optimal')
    expect(message).toContain('on target')
  })

  it('returns acceptable message', () => {
    const { recommendation } = getFeedbackMessage('acceptable')
    expect(recommendation).toContain('recent meal')
  })

  it('returns poor message', () => {
    const { message } = getFeedbackMessage('poor')
    expect(message).toContain('drifted')
  })

  it('returns no_data message', () => {
    const { message } = getFeedbackMessage('no_data')
    expect(message).toContain('No meals')
  })
})
