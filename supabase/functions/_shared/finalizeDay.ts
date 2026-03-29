import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const CALCULATION_VERSION = 'v1'

interface ProfileRow {
  user_id: string
  calorie_target: number | null
}

interface DailyLogRow {
  id: string
  user_id: string
  log_date: string
  total_calories: number
  meal_count: number
  is_finalized: boolean
  finalized_at: string | null
}

interface DailyEvaluationRow {
  id: string
  adjusted_adherence: number
}

interface HabitMetricsRow {
  current_streak: number
  longest_streak: number
  last_log_date: string | null
  log_date: string
}

interface EvaluationWindowRow {
  status: string
  adjusted_adherence: number
  consumed_calories: number
}

interface ExistingPayloadResult<T> {
  data: T | null
}

export interface FinalizedPayload {
  daily_log: Record<string, unknown>
  evaluation: Record<string, unknown> | null
  habit_metrics: Record<string, unknown> | null
  behavior_attributes: Record<string, unknown> | null
  creature_stats: Record<string, unknown> | null
  daily_feedback: Record<string, unknown> | null
}

export async function finalizeDay(
  supabase: SupabaseClient,
  userId: string,
  logDate: string,
): Promise<FinalizedPayload> {
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('user_id, calorie_target')
    .eq('user_id', userId)
    .single()

  if (profileErr || !profile) throw new Error('Profile not found')
  const typedProfile = profile as ProfileRow
  if (!typedProfile.calorie_target) throw new Error('Calorie target not set')

  const { error: logUpsertErr } = await supabase
    .from('daily_logs')
    .upsert({ user_id: userId, log_date: logDate }, { onConflict: 'user_id,log_date', ignoreDuplicates: true })
  if (logUpsertErr) throw new Error(logUpsertErr.message)

  const { data: dailyLogData, error: logErr } = await supabase
    .from('daily_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('log_date', logDate)
    .single()
  if (logErr || !dailyLogData) throw new Error(logErr?.message ?? 'Daily log not found')

  const dailyLog = dailyLogData as DailyLogRow

  if (dailyLog.is_finalized) {
    return loadExistingFinalizedPayload(supabase, userId, logDate, dailyLog)
  }

  const target = typedProfile.calorie_target
  const consumed = dailyLog.total_calories
  const hasMeals = dailyLog.meal_count > 0
  const delta = consumed - target
  const adherenceScore = calculateAdherenceScore(consumed, target)
  const adjustedAdherence = hasMeals ? calculateAdjustedAdherence(adherenceScore, delta) : 0
  const status = hasMeals ? classifyStatus(adjustedAdherence) : 'no_data'

  let finalAdjustedAdherence = adjustedAdherence
  if (!hasMeals) {
    const { data: prevEvalData } = await supabase
      .from('daily_evaluations')
      .select('adjusted_adherence')
      .eq('user_id', userId)
      .lt('log_date', logDate)
      .order('log_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    const prevAdj = (prevEvalData as DailyEvaluationRow | null)?.adjusted_adherence ?? 0
    finalAdjustedAdherence = round2(prevAdj * 0.9)
  }

  const finalizedAt = new Date().toISOString()

  const evaluationData = {
    user_id: userId,
    daily_log_id: dailyLog.id,
    log_date: logDate,
    target_calories: target,
    consumed_calories: consumed,
    calorie_delta: delta,
    adherence_score: adherenceScore,
    adjusted_adherence: finalAdjustedAdherence,
    status,
    calculation_version: CALCULATION_VERSION,
    finalized_at: finalizedAt,
  }

  const { data: evaluation, error: evalErr } = await supabase
    .from('daily_evaluations')
    .upsert(evaluationData, { onConflict: 'user_id,log_date' })
    .select()
    .single()
  if (evalErr) throw new Error(evalErr.message)

  const { data: prevMetricsData } = await supabase
    .from('habit_metrics')
    .select('*')
    .eq('user_id', userId)
    .lt('log_date', logDate)
    .order('log_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const prevMetricsRow = prevMetricsData as HabitMetricsRow | null

  const { data: recentEvalData } = await supabase
    .from('daily_evaluations')
    .select('*')
    .eq('user_id', userId)
    .lte('log_date', logDate)
    .order('log_date', { ascending: false })
    .limit(7)

  const recentEvals = (recentEvalData ?? []) as EvaluationWindowRow[]
  const last3Evals = recentEvals.slice(0, 3)
  const qualifyingDaysTodayIncluded = recentEvals.filter(
    (entry) => entry.status !== 'no_data' && entry.adjusted_adherence >= 70,
  ).length

  let currentStreak = 0
  const todayQualifies = status !== 'no_data' && finalAdjustedAdherence >= 70
  if (todayQualifies) {
    const prevDate = addDays(logDate, -1)
    if (prevMetricsRow && prevMetricsRow.log_date === prevDate && prevMetricsRow.current_streak > 0) {
      currentStreak = prevMetricsRow.current_streak + 1
    } else {
      currentStreak = 1
    }
  }

  const longestStreak = Math.max(prevMetricsRow?.longest_streak ?? 0, currentStreak)
  const daysLoggedLast7 = recentEvals.filter((entry) => entry.consumed_calories > 0).length
  const lastLogDate = hasMeals ? logDate : (prevMetricsRow?.last_log_date ?? null)

  const { data: habitMetrics, error: habitErr } = await supabase
    .from('habit_metrics')
    .upsert(
      {
        user_id: userId,
        log_date: logDate,
        current_streak: currentStreak,
        longest_streak: longestStreak,
        days_logged_last_7: daysLoggedLast7,
        last_log_date: lastLogDate,
      },
      { onConflict: 'user_id,log_date' },
    )
    .select()
    .single()
  if (habitErr) throw new Error(habitErr.message)

  const consistencyScore = round2(avg(recentEvals.map((entry) => entry.adjusted_adherence)))
  const stabilityScore = round2(
    clamp(100 - stddevPop(recentEvals.map((entry) => entry.adjusted_adherence)), 20, 100),
  )
  const momentumScore = round2(avg(last3Evals.map((entry) => entry.adjusted_adherence)))
  const disciplineScore = round2((qualifyingDaysTodayIncluded / 7) * 100)

  const { data: behaviorAttributes, error: behaviorErr } = await supabase
    .from('behavior_attributes')
    .upsert(
      {
        user_id: userId,
        log_date: logDate,
        consistency_score: consistencyScore,
        stability_score: stabilityScore,
        momentum_score: momentumScore,
        discipline_score: disciplineScore,
        calculation_version: CALCULATION_VERSION,
        calculated_at: finalizedAt,
      },
      { onConflict: 'user_id,log_date' },
    )
    .select()
    .single()
  if (behaviorErr) throw new Error(behaviorErr.message)

  const { data: creatureStats, error: creatureErr } = await supabase
    .from('creature_stats')
    .upsert(
      {
        user_id: userId,
        log_date: logDate,
        strength: clamp(Math.round(consistencyScore), 0, 100),
        resilience: clamp(Math.round(stabilityScore), 0, 100),
        momentum: clamp(Math.round(momentumScore), 0, 100),
        vitality: clamp(50 + currentStreak * 5, 50, 999),
        stage: 'baby',
      },
      { onConflict: 'user_id,log_date' },
    )
    .select()
    .single()
  if (creatureErr) throw new Error(creatureErr.message)

  const feedback = getFeedbackMessage(status)
  const { data: dailyFeedback, error: feedbackErr } = await supabase
    .from('daily_feedback')
    .upsert(
      {
        user_id: userId,
        log_date: logDate,
        daily_evaluation_id: (evaluation as { id: string }).id,
        status,
        message: feedback.message,
        recommendation: feedback.recommendation,
      },
      { onConflict: 'user_id,log_date' },
    )
    .select()
    .single()
  if (feedbackErr) throw new Error(feedbackErr.message)

  const { data: finalizedLog, error: finalErr } = await supabase
    .from('daily_logs')
    .update({ is_finalized: true, finalized_at: finalizedAt })
    .eq('id', dailyLog.id)
    .select()
    .single()
  if (finalErr) throw new Error(finalErr.message)

  return {
    daily_log: finalizedLog as Record<string, unknown>,
    evaluation: evaluation as Record<string, unknown>,
    habit_metrics: habitMetrics as Record<string, unknown>,
    behavior_attributes: behaviorAttributes as Record<string, unknown>,
    creature_stats: creatureStats as Record<string, unknown>,
    daily_feedback: dailyFeedback as Record<string, unknown>,
  }
}

async function loadExistingFinalizedPayload(
  supabase: SupabaseClient,
  userId: string,
  logDate: string,
  dailyLog: DailyLogRow,
): Promise<FinalizedPayload> {
  const [evaluation, habitMetrics, behaviorAttributes, creatureStats, dailyFeedback] = await Promise.all([
    supabase.from('daily_evaluations').select('*').eq('user_id', userId).eq('log_date', logDate).maybeSingle(),
    supabase.from('habit_metrics').select('*').eq('user_id', userId).eq('log_date', logDate).maybeSingle(),
    supabase.from('behavior_attributes').select('*').eq('user_id', userId).eq('log_date', logDate).maybeSingle(),
    supabase.from('creature_stats').select('*').eq('user_id', userId).eq('log_date', logDate).maybeSingle(),
    supabase.from('daily_feedback').select('*').eq('user_id', userId).eq('log_date', logDate).maybeSingle(),
  ])

  return {
    daily_log: dailyLog as unknown as Record<string, unknown>,
    evaluation: unwrapPayload(evaluation),
    habit_metrics: unwrapPayload(habitMetrics),
    behavior_attributes: unwrapPayload(behaviorAttributes),
    creature_stats: unwrapPayload(creatureStats),
    daily_feedback: unwrapPayload(dailyFeedback),
  }
}

function unwrapPayload<T extends ExistingPayloadResult<Record<string, unknown>>>(result: T): Record<string, unknown> | null {
  return result.data ?? null
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function calculateAdherenceScore(consumed: number, target: number): number {
  if (consumed === 0) return 0
  const delta = consumed - target
  if (delta <= 0) return 100
  if (delta <= 200) return round2(100 - delta * 0.1)
  if (delta <= 500) return round2(80 - (delta - 200) * 0.1)
  return round2(Math.max(0, 50 - (delta - 500) * 0.1))
}

export function calculateAdjustedAdherence(adherenceScore: number, delta: number): number {
  let adjusted = adherenceScore
  if (delta < -500) {
    adjusted -= Math.abs(delta + 500) * 0.1
  }
  return round2(clamp(adjusted, 0, 100))
}

export function classifyStatus(adjustedAdherence: number): string {
  if (adjustedAdherence >= 90) return 'optimal'
  if (adjustedAdherence >= 70) return 'acceptable'
  return 'poor'
}

export function getFeedbackMessage(status: string): { message: string; recommendation: string } {
  switch (status) {
    case 'optimal':
      return { message: 'You stayed on target today. Keep the streak alive.', recommendation: 'Repeat what worked today.' }
    case 'acceptable':
      return { message: 'Close to target today. Small adjustments keep momentum strong.', recommendation: 'Use a recent meal tomorrow to make logging easy.' }
    case 'poor':
      return { message: 'Today drifted off target. Reset with one simple win at your next meal.', recommendation: 'Log the next meal even if the day is not perfect.' }
    default:
      return { message: 'No meals logged today. One logged meal tomorrow is enough to restart momentum.', recommendation: 'Use quick add as early as possible tomorrow.' }
  }
}

export function avg(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function stddevPop(values: number[]): number {
  if (values.length === 0) return 0
  const mean = avg(values)
  const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length
  return Math.sqrt(variance)
}

export function addDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getLocalTime(utcDate: Date, timezone: string): Date {
  const localStr = utcDate.toLocaleString('en-CA', { timeZone: timezone, hour12: false })
  return new Date(localStr)
}

export function shouldProcessLocalTime(date: Date): boolean {
  const hour = date.getHours()
  const minute = date.getMinutes()
  return (hour === 0 && minute >= 5) || hour === 1
}
