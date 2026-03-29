import type { EvaluationStatus, BehaviorAttributes, CreatureStats, HabitMetrics, DailyEvaluation } from '@/types/domain'
import {
  STREAK_THRESHOLD,
  OPTIMAL_THRESHOLD,
  ACCEPTABLE_THRESHOLD,
  CREATURE_STAT_MIN,
  CREATURE_STAT_MAX,
  VITALITY_BASE,
  VITALITY_MIN,
  VITALITY_MAX,
  CALCULATION_VERSION,
} from '@/lib/constants'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

// §12.2 Raw Adherence Score
export function calculateAdherenceScore(consumed: number, target: number): number {
  if (consumed === 0) return 0
  const delta = consumed - target
  if (delta <= 0) return 100
  if (delta <= 200) return round2(100 - delta * 0.1)
  if (delta <= 500) return round2(80 - (delta - 200) * 0.1)
  return round2(Math.max(0, 50 - (delta - 500) * 0.1))
}

// §12.2 Adjusted Adherence
export function calculateAdjustedAdherence(adherenceScore: number, delta: number): number {
  let adjusted = adherenceScore
  if (delta < -500) {
    adjusted -= Math.abs(delta + 500) * 0.1
  }
  return round2(clamp(adjusted, 0, 100))
}

// §12.2 Status classification
export function classifyStatus(adjustedAdherence: number, hasMeals: boolean): EvaluationStatus {
  if (!hasMeals) return 'no_data'
  if (adjustedAdherence >= OPTIMAL_THRESHOLD) return 'optimal'
  if (adjustedAdherence >= ACCEPTABLE_THRESHOLD) return 'acceptable'
  return 'poor'
}

// §12.2 No-data adjusted adherence decay
export function calculateNoDataAdjustedAdherence(previousAdjustedAdherence: number | null): number {
  const prev = previousAdjustedAdherence ?? 0
  return round2(prev * 0.9)
}

// §12.3 Habit Metrics calculation
// prevMetrics: the habit_metrics row from the previous calendar date (null if first day)
// currentEval: the evaluation for today
// last7Evals: evaluations for the last 7 days including today (ordered newest first)
export function calculateHabitMetrics(
  prevMetrics: Pick<HabitMetrics, 'currentStreak' | 'longestStreak' | 'lastLogDate' | 'logDate'> | null,
  currentEval: Pick<DailyEvaluation, 'logDate' | 'status' | 'adjustedAdherence' | 'consumedCalories'>,
  last7Evals: Pick<DailyEvaluation, 'logDate' | 'status' | 'consumedCalories'>[],
): Omit<HabitMetrics, 'id' | 'userId' | 'createdAt'> {
  const todayQualifies = isQualifyingDay(currentEval)
  const hasMealsToday = currentEval.consumedCalories > 0

  // streak calculation
  let currentStreak: number
  if (!todayQualifies) {
    currentStreak = 0
  } else if (
    prevMetrics !== null &&
    isPreviousCalendarDate(currentEval.logDate, prevMetrics.logDate) &&
    prevMetrics.currentStreak > 0
  ) {
    currentStreak = prevMetrics.currentStreak + 1
  } else {
    currentStreak = 1
  }

  const longestStreak = Math.max(prevMetrics?.longestStreak ?? 0, currentStreak)

  // days_logged_last_7: days with at least one meal among last 7 finalized dates
  const daysLoggedLast7 = last7Evals.filter(e => e.consumedCalories > 0).length

  // last_log_date
  const lastLogDate = hasMealsToday
    ? currentEval.logDate
    : (prevMetrics?.lastLogDate ?? null)

  return {
    logDate: currentEval.logDate,
    currentStreak,
    longestStreak,
    daysLoggedLast7,
    lastLogDate,
  }
}

function isQualifyingDay(
  evaluation: Pick<DailyEvaluation, 'status' | 'adjustedAdherence'>,
): boolean {
  return evaluation.status !== 'no_data' && evaluation.adjustedAdherence >= STREAK_THRESHOLD
}

function isPreviousCalendarDate(today: string, candidate: string): boolean {
  const todayDate = new Date(today + 'T00:00:00Z')
  const candidateDate = new Date(candidate + 'T00:00:00Z')
  const diff = todayDate.getTime() - candidateDate.getTime()
  return diff === 86400000 // exactly 1 day in ms
}

// §12.4 Behavior Attributes
// evals: last 7 finalized evaluations ordered newest first (may be fewer than 7)
export function calculateBehaviorAttributes(
  evals: Pick<DailyEvaluation, 'logDate' | 'adjustedAdherence' | 'status'>[],
  logDate: string,
): Omit<BehaviorAttributes, 'id' | 'userId' | 'createdAt'> {
  const last7 = evals.slice(0, 7)
  const last3 = evals.slice(0, 3)

  const consistencyScore = round2(avg(last7.map(e => e.adjustedAdherence)))
  const stabilityScore = round2(clamp(100 - stddevPop(last7.map(e => e.adjustedAdherence)), 20, 100))
  const momentumScore = round2(avg(last3.map(e => e.adjustedAdherence)))

  const qualifyingDaysLast7 = last7.filter(
    e => e.status !== 'no_data' && e.adjustedAdherence >= STREAK_THRESHOLD,
  ).length
  const disciplineScore = round2((qualifyingDaysLast7 / 7) * 100)

  return {
    logDate,
    consistencyScore,
    stabilityScore,
    momentumScore,
    disciplineScore,
    calculationVersion: CALCULATION_VERSION,
    calculatedAt: new Date().toISOString(),
  }
}

// §12.5 Creature Stats
export function calculateCreatureStats(
  attrs: Pick<BehaviorAttributes, 'consistencyScore' | 'stabilityScore' | 'momentumScore'>,
  currentStreak: number,
  logDate: string,
): Omit<CreatureStats, 'id' | 'userId' | 'createdAt'> {
  return {
    logDate,
    strength: clamp(Math.round(attrs.consistencyScore), CREATURE_STAT_MIN, CREATURE_STAT_MAX),
    resilience: clamp(Math.round(attrs.stabilityScore), CREATURE_STAT_MIN, CREATURE_STAT_MAX),
    momentum: clamp(Math.round(attrs.momentumScore), CREATURE_STAT_MIN, CREATURE_STAT_MAX),
    vitality: clamp(VITALITY_BASE + currentStreak * 5, VITALITY_MIN, VITALITY_MAX),
    stage: 'baby',
  }
}

// §12.6 Daily Feedback messages
export function getFeedbackMessage(status: EvaluationStatus): {
  message: string
  recommendation: string
} {
  switch (status) {
    case 'optimal':
      return {
        message: 'You stayed on target today. Keep the streak alive.',
        recommendation: 'Repeat what worked today.',
      }
    case 'acceptable':
      return {
        message: 'Close to target today. Small adjustments keep momentum strong.',
        recommendation: 'Use a recent meal tomorrow to make logging easy.',
      }
    case 'poor':
      return {
        message: 'Today drifted off target. Reset with one simple win at your next meal.',
        recommendation: 'Log the next meal even if the day is not perfect.',
      }
    case 'no_data':
      return {
        message: 'No meals logged today. One logged meal tomorrow is enough to restart momentum.',
        recommendation: 'Use quick add as early as possible tomorrow.',
      }
  }
}

// Statistical helpers
function avg(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function stddevPop(values: number[]): number {
  if (values.length === 0) return 0
  const mean = avg(values)
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
  return Math.sqrt(variance)
}
