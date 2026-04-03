import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  DEFAULT_COMPANION_NAME,
  getCondition,
  getFinalizationXp,
  getHigherStage,
  getLevelFromXp,
  getLikelyOutcome,
  getReadinessBand,
  getReadinessScore,
  getUnlockedStage,
  type CreatureStage,
} from './battleSystem.ts'

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
  days_logged_last_7: number
  last_log_date: string | null
  log_date: string
}

interface EvaluationWindowRow {
  status: string
  adjusted_adherence: number
  consumed_calories: number
}

interface CreatureStatsRow {
  id: string
  user_id: string
  log_date: string
  strength: number
  resilience: number
  momentum: number
  vitality: number
  stage: CreatureStage
}

interface CreatureCompanionRow {
  user_id: string
  name: string
  stage: CreatureStage
  level: number
  xp: number
  current_condition: 'thriving' | 'steady' | 'recovering'
  hatched_at: string
  evolved_to_adult_at: string | null
  evolved_to_champion_at: string | null
  created_at: string
  updated_at: string
}

interface CreatureBattleSnapshotRow {
  id: string
  user_id: string
  prep_date: string
  battle_date: string
  strength: number
  resilience: number
  momentum: number
  vitality: number
  readiness_score: number
  readiness_band: 'recovering' | 'building' | 'ready' | 'peak'
  condition: 'thriving' | 'steady' | 'recovering'
  level: number
  stage: CreatureStage
  source_daily_evaluation_id: string
  xp_gained: number
  created_at: string
}

interface BattleOpponentRow {
  id: string
  name: string
  archetype: string
  recommended_level: number
  strength: number
  resilience: number
  momentum: number
  vitality: number
  sort_order: number
  unlock_level: number
  is_defeated?: boolean
  is_challengeable?: boolean
  required_previous_opponent_id?: string | null
  required_previous_opponent_name?: string | null
  lock_reason?: string | null
}

interface ExistingPayloadResult<T> {
  data: T | null
}

interface BattleRecommendationPayload {
  opponent_id: string
  name: string
  archetype: string
  recommended_level: number
  likely_outcome: 'favored' | 'competitive' | 'risky'
}

interface BattlePrepPayload {
  prep_date: string
  battle_date: string
  snapshot_id: string
  readiness_score: number
  readiness_band: 'recovering' | 'building' | 'ready' | 'peak'
  condition: 'thriving' | 'steady' | 'recovering'
  recommended_opponent: BattleRecommendationPayload | null
  xp_gained: number
}

export interface FinalizedPayload {
  daily_log: Record<string, unknown>
  evaluation: Record<string, unknown> | null
  habit_metrics: Record<string, unknown> | null
  behavior_attributes: Record<string, unknown> | null
  creature_stats: Record<string, unknown> | null
  daily_feedback: Record<string, unknown> | null
  battle_prep?: BattlePrepPayload | null
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
    await ensureLegacyBattlePrepBackfill(supabase, userId, logDate, dailyLog)
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
  const unlockedStage = getUnlockedStage(longestStreak)

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
        stage: unlockedStage,
      },
      { onConflict: 'user_id,log_date' },
    )
    .select()
    .single()
  if (creatureErr) throw new Error(creatureErr.message)

  const battlePrep = await upsertCompanionBattleState(supabase, {
    userId,
    logDate,
    finalizedAt,
    evaluationId: (evaluation as { id: string }).id,
    creatureStats: creatureStats as CreatureStatsRow,
    hasMeals,
    adjustedAdherence: finalAdjustedAdherence,
    currentStreak,
    longestStreak,
  })

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
    battle_prep: battlePrep,
  }
}

async function upsertCompanionBattleState(
  supabase: SupabaseClient,
  input: {
    userId: string
    logDate: string
    finalizedAt: string
    evaluationId: string
    creatureStats: CreatureStatsRow
    hasMeals: boolean
    adjustedAdherence: number
    currentStreak: number
    longestStreak: number
  },
): Promise<BattlePrepPayload> {
  const battleDate = addDays(input.logDate, 1)

  const [existingCompanionRes, existingSnapshotRes, allSnapshotXpRes, rewardedBattleXpRes] = await Promise.all([
    supabase.from('creature_companions').select('*').eq('user_id', input.userId).maybeSingle(),
    supabase.from('creature_battle_snapshots').select('*').eq('user_id', input.userId).eq('prep_date', input.logDate).maybeSingle(),
    supabase.from('creature_battle_snapshots').select('xp_gained').eq('user_id', input.userId),
    supabase.from('battle_runs').select('xp_awarded').eq('user_id', input.userId).eq('reward_claimed', true),
  ])

  const existingCompanion = (existingCompanionRes.data ?? null) as CreatureCompanionRow | null
  const existingSnapshot = (existingSnapshotRes.data ?? null) as CreatureBattleSnapshotRow | null
  const existingSnapshotXp = existingSnapshot?.xp_gained ?? 0
  const totalSnapshotXpBefore = (allSnapshotXpRes.data ?? []).reduce(
    (sum, row) => sum + ((row as { xp_gained: number }).xp_gained ?? 0),
    0,
  )
  const totalRewardedBattleXp = (rewardedBattleXpRes.data ?? []).reduce(
    (sum, row) => sum + ((row as { xp_awarded: number }).xp_awarded ?? 0),
    0,
  )

  const stage = getHigherStage(existingCompanion?.stage ?? getUnlockedStage(input.longestStreak), getUnlockedStage(input.longestStreak))
  const xpGained = getFinalizationXp(input.adjustedAdherence, input.hasMeals ? classifyStatus(input.adjustedAdherence) : 'no_data', input.currentStreak)
  const totalXp = totalSnapshotXpBefore - existingSnapshotXp + xpGained + totalRewardedBattleXp
  const level = getLevelFromXp(totalXp)
  const readinessScore = getReadinessScore(input.creatureStats)
  const readinessBand = getReadinessBand(readinessScore)
  const condition = getCondition({
    hasMeals: input.hasMeals,
    adjustedAdherence: input.adjustedAdherence,
    currentStreak: input.currentStreak,
    readinessScore,
  })

  const { data: snapshotData, error: snapshotErr } = await supabase
    .from('creature_battle_snapshots')
    .upsert(
      {
        user_id: input.userId,
        prep_date: input.logDate,
        battle_date: battleDate,
        strength: input.creatureStats.strength,
        resilience: input.creatureStats.resilience,
        momentum: input.creatureStats.momentum,
        vitality: input.creatureStats.vitality,
        readiness_score: readinessScore,
        readiness_band: readinessBand,
        condition,
        level,
        stage,
        source_daily_evaluation_id: input.evaluationId,
        xp_gained: xpGained,
      },
      { onConflict: 'user_id,battle_date' },
    )
    .select()
    .single()
  if (snapshotErr || !snapshotData) throw new Error(snapshotErr?.message ?? 'Unable to upsert battle snapshot')

  const evolvedToAdultAt = stage === 'adult' || stage === 'champion'
    ? existingCompanion?.evolved_to_adult_at ?? await getEvolutionTimestamp(supabase, input.userId, 7, input.finalizedAt)
    : null
  const evolvedToChampionAt = stage === 'champion'
    ? existingCompanion?.evolved_to_champion_at ?? await getEvolutionTimestamp(supabase, input.userId, 30, input.finalizedAt)
    : null

  const { error: companionErr } = await supabase
    .from('creature_companions')
    .upsert(
      {
        user_id: input.userId,
        name: existingCompanion?.name ?? DEFAULT_COMPANION_NAME,
        stage,
        level,
        xp: totalXp,
        current_condition: condition,
        hatched_at: existingCompanion?.hatched_at ?? input.finalizedAt,
        evolved_to_adult_at: evolvedToAdultAt,
        evolved_to_champion_at: evolvedToChampionAt,
      },
      { onConflict: 'user_id' },
    )
  if (companionErr) throw new Error(companionErr.message)

  const arenaOpponents = await getArenaOpponents(supabase, input.userId)
  const recommendedOpponent = getRecommendedOpponent(snapshotData as CreatureBattleSnapshotRow, arenaOpponents)

  return {
    prep_date: input.logDate,
    battle_date: battleDate,
    snapshot_id: (snapshotData as CreatureBattleSnapshotRow).id,
    readiness_score: readinessScore,
    readiness_band: readinessBand,
    condition,
    recommended_opponent: recommendedOpponent,
    xp_gained: xpGained,
  }
}

async function getEvolutionTimestamp(
  supabase: SupabaseClient,
  userId: string,
  threshold: number,
  fallbackTimestamp: string,
): Promise<string> {
  const { data } = await supabase
    .from('habit_metrics')
    .select('log_date')
    .eq('user_id', userId)
    .gte('current_streak', threshold)
    .order('log_date', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!data?.log_date) return fallbackTimestamp
  return `${data.log_date}T00:00:00.000Z`
}

async function getArenaOpponents(
  supabase: SupabaseClient,
  userId: string,
): Promise<BattleOpponentRow[]> {
  const { data: arenaRow, error: arenaError } = await supabase
    .from('battle_arenas')
    .select('id')
    .eq('arena_key', 'arena_1')
    .eq('is_active', true)
    .maybeSingle()

  if (arenaError) throw new Error(arenaError.message)
  if (!arenaRow?.id) return []

  const [{ data: opponentsData, error: opponentsError }, { data: winsData, error: winsError }] = await Promise.all([
    supabase
      .from('battle_opponents')
      .select('id, name, archetype, recommended_level, strength, resilience, momentum, vitality, sort_order, unlock_level')
      .eq('arena_id', arenaRow.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('battle_runs')
      .select('opponent_id')
      .eq('user_id', userId)
      .eq('outcome', 'win'),
  ])

  if (opponentsError) throw new Error(opponentsError.message)
  if (winsError) throw new Error(winsError.message)

  const wins = new Set((winsData ?? []).map((row) => (row as { opponent_id: string }).opponent_id))
  const opponents = (opponentsData ?? []) as BattleOpponentRow[]

  return opponents.map((opponent, index) => {
    const previous = index > 0 ? opponents[index - 1] : null
    const isChallengeable = previous ? wins.has(previous.id) : true

    return {
      ...opponent,
      is_defeated: wins.has(opponent.id),
      is_challengeable: isChallengeable,
      required_previous_opponent_id: previous?.id ?? null,
      required_previous_opponent_name: previous?.name ?? null,
      lock_reason: isChallengeable || !previous ? null : `Beat ${previous.name} first.`,
    }
  })
}

function getRecommendedOpponent(
  snapshot: CreatureBattleSnapshotRow,
  opponents: BattleOpponentRow[],
): BattleRecommendationPayload | null {
  const challengeableOpponents = opponents.filter((opponent) => opponent.is_challengeable !== false)
  if (challengeableOpponents.length === 0) return null

  return [...challengeableOpponents]
    .map((opponent) => {
      const likelyOutcome = getLikelyOutcome(
        {
          strength: snapshot.strength,
          resilience: snapshot.resilience,
          momentum: snapshot.momentum,
          vitality: snapshot.vitality,
          level: snapshot.level,
          stage: snapshot.stage,
        },
        {
          recommendedLevel: opponent.recommended_level,
          strength: opponent.strength,
          resilience: opponent.resilience,
          momentum: opponent.momentum,
          vitality: opponent.vitality,
        },
      )

      return {
        opponent_id: opponent.id,
        name: opponent.name,
        archetype: opponent.archetype,
        recommended_level: opponent.recommended_level,
        likely_outcome: likelyOutcome,
        isDefeated: opponent.is_defeated ?? false,
        rank:
          likelyOutcome === 'favored'
            ? 0
            : likelyOutcome === 'competitive'
              ? 1
              : 2,
        sortOrder: opponent.sort_order,
      }
    })
    .sort((left, right) => {
      if (left.isDefeated !== right.isDefeated) return left.isDefeated ? 1 : -1
      if (left.rank !== right.rank) return left.rank - right.rank
      if (left.rank === 0 && left.recommended_level !== right.recommended_level) {
        return right.recommended_level - left.recommended_level
      }
      if (left.rank !== 0 && left.recommended_level !== right.recommended_level) {
        return left.recommended_level - right.recommended_level
      }
      return left.sortOrder - right.sortOrder
    })[0]
}

async function loadExistingFinalizedPayload(
  supabase: SupabaseClient,
  userId: string,
  logDate: string,
  dailyLog: DailyLogRow,
): Promise<FinalizedPayload> {
  const [evaluation, habitMetrics, behaviorAttributes, creatureStats, dailyFeedback, battlePrep] = await Promise.all([
    supabase.from('daily_evaluations').select('*').eq('user_id', userId).eq('log_date', logDate).maybeSingle(),
    supabase.from('habit_metrics').select('*').eq('user_id', userId).eq('log_date', logDate).maybeSingle(),
    supabase.from('behavior_attributes').select('*').eq('user_id', userId).eq('log_date', logDate).maybeSingle(),
    supabase.from('creature_stats').select('*').eq('user_id', userId).eq('log_date', logDate).maybeSingle(),
    supabase.from('daily_feedback').select('*').eq('user_id', userId).eq('log_date', logDate).maybeSingle(),
    loadBattlePrepSummary(supabase, userId, logDate),
  ])

  return {
    daily_log: dailyLog as unknown as Record<string, unknown>,
    evaluation: unwrapPayload(evaluation),
    habit_metrics: unwrapPayload(habitMetrics),
    behavior_attributes: unwrapPayload(behaviorAttributes),
    creature_stats: unwrapPayload(creatureStats),
    daily_feedback: unwrapPayload(dailyFeedback),
    battle_prep: battlePrep,
  }
}

async function ensureLegacyBattlePrepBackfill(
  supabase: SupabaseClient,
  userId: string,
  logDate: string,
  dailyLog: DailyLogRow,
): Promise<void> {
  const { data: snapshotData, error: snapshotErr } = await supabase
    .from('creature_battle_snapshots')
    .select('id')
    .eq('user_id', userId)
    .eq('prep_date', logDate)
    .maybeSingle()

  if (snapshotErr) throw new Error(snapshotErr.message)
  if (snapshotData?.id) return

  const [evaluationRes, habitMetricsRes, creatureStatsRes] = await Promise.all([
    supabase.from('daily_evaluations').select('*').eq('user_id', userId).eq('log_date', logDate).maybeSingle(),
    supabase.from('habit_metrics').select('*').eq('user_id', userId).eq('log_date', logDate).maybeSingle(),
    supabase.from('creature_stats').select('*').eq('user_id', userId).eq('log_date', logDate).maybeSingle(),
  ])

  if (evaluationRes.error) throw new Error(evaluationRes.error.message)
  if (habitMetricsRes.error) throw new Error(habitMetricsRes.error.message)
  if (creatureStatsRes.error) throw new Error(creatureStatsRes.error.message)

  const evaluation = evaluationRes.data as {
    id: string
    adjusted_adherence: number
  } | null
  const habitMetrics = habitMetricsRes.data as HabitMetricsRow | null
  const creatureStats = creatureStatsRes.data as CreatureStatsRow | null

  if (!evaluation || !habitMetrics || !creatureStats) return

  await upsertCompanionBattleState(supabase, {
    userId,
    logDate,
    finalizedAt: dailyLog.finalized_at ?? new Date().toISOString(),
    evaluationId: evaluation.id,
    creatureStats,
    hasMeals: dailyLog.meal_count > 0,
    adjustedAdherence: evaluation.adjusted_adherence,
    currentStreak: habitMetrics.current_streak,
    longestStreak: habitMetrics.longest_streak,
  })
}

async function loadBattlePrepSummary(
  supabase: SupabaseClient,
  userId: string,
  logDate: string,
): Promise<BattlePrepPayload | null> {
  const [snapshotRes, companionRes] = await Promise.all([
    supabase.from('creature_battle_snapshots').select('*').eq('user_id', userId).eq('prep_date', logDate).maybeSingle(),
    supabase.from('creature_companions').select('*').eq('user_id', userId).maybeSingle(),
  ])

  const snapshot = (snapshotRes.data ?? null) as CreatureBattleSnapshotRow | null
  if (!snapshot) return null

  const companion = (companionRes.data ?? null) as CreatureCompanionRow | null
  const arenaOpponents = await getArenaOpponents(supabase, userId)
  const recommendedOpponent = getRecommendedOpponent(snapshot, arenaOpponents)

  return {
    prep_date: snapshot.prep_date,
    battle_date: snapshot.battle_date,
    snapshot_id: snapshot.id,
    readiness_score: snapshot.readiness_score,
    readiness_band: snapshot.readiness_band,
    condition: snapshot.condition,
    recommended_opponent: recommendedOpponent,
    xp_gained: snapshot.xp_gained,
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
