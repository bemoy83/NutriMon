import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInvalidateDailyLog } from '@/features/logging/useDailyLog'
import { habitMetricsForStreak } from '@/features/logging/dailyLogScreenPayload'
import { useDailyLogScreen } from '@/features/logging/useDailyLogScreen'
import { getTodayInTimezone } from '@/lib/date'
import type { BattlePrepSummary, CreaturePreview, FinalizeDayResponse, Meal } from '@/types/domain'
import { getDefaultMealType, type MealType } from '@/lib/mealType'
import type { DeleteMealResult, MealMutationResult } from '@/types/database'
import { useFinalizeDay } from '@/features/logging/useFinalizeDay'
import { useRepeatLastMealAction } from '@/features/logging/useRepeatLastMealAction'
import { useUndoToast } from '@/features/logging/useUndoToast'
import { buildMealSnapshotItems } from '@/features/logging/mealPayloads'
import { restoreMealFromSnapshot } from '@/features/logging/api'
import type { DailyLogDateHeaderProps, DailyLogSummaryCardProps } from '@/features/logging/DailyLogHeader'

const EMPTY_MEALS: Meal[] = []

function mapCreaturePreviewPayload(
  preview: MealMutationResult['creature_preview'] | DeleteMealResult['creature_preview'],
): CreaturePreview | null {
  if (!preview) return null
  return {
    tomorrowReadinessScore: preview.tomorrow_readiness_score,
    tomorrowReadinessBand: preview.tomorrow_readiness_band,
    projectedStrength: preview.projected_strength,
    projectedResilience: preview.projected_resilience,
    projectedMomentum: preview.projected_momentum,
    projectedVitality: preview.projected_vitality,
    mealRating: preview.meal_rating,
    mealFeedbackMessage: preview.meal_feedback_message,
  }
}

function mapBattlePrepPayload(payload: FinalizeDayResponse['battle_prep']): BattlePrepSummary | null {
  if (!payload) return null
  return {
    prepDate: payload.prep_date,
    battleDate: payload.battle_date,
    snapshotId: payload.snapshot_id,
    readinessScore: payload.readiness_score,
    readinessBand: payload.readiness_band,
    condition: payload.condition,
    recommendedOpponent: payload.recommended_opponent
      ? {
          opponentId: payload.recommended_opponent.opponent_id,
          name: payload.recommended_opponent.name,
          archetype: payload.recommended_opponent.archetype,
          recommendedLevel: payload.recommended_opponent.recommended_level,
          likelyOutcome: payload.recommended_opponent.likely_outcome,
        }
      : null,
    xpGained: payload.xp_gained,
  }
}

/**
 * Screen orchestration for the daily log: screen query, meal actions, undo, finalize, repeat, derived props for header/summary.
 */
export function useDailyLogPage(logDate: string) {
  const navigate = useNavigate()
  const screenQuery = useDailyLogScreen(logDate)
  const invalidateDailyLog = useInvalidateDailyLog()
  const [quickAddLoggedAt, setQuickAddLoggedAt] = useState(() => new Date().toISOString())
  const nowIso = new Date().toISOString()
  const currentMealType = getDefaultMealType(nowIso)
  const isEveningOrLater = new Date().getHours() >= 17

  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [addToSlotType, setAddToSlotType] = useState<MealType | null>(null)
  const [creaturePreviewState, setCreaturePreviewState] = useState<{
    date: string
    preview: CreaturePreview | null
  } | null>(null)
  const [battlePrepState, setBattlePrepState] = useState<{
    date: string
    summary: BattlePrepSummary | null
  } | null>(null)
  const { undoAction, showUndo, clearUndo } = useUndoToast()

  const screen = screenQuery.data
  const timezone = screen?.profile.timezone ?? 'UTC'
  const calorieTarget = screen?.profile.calorieTarget ?? 0
  const dailyLog = screen?.dailyLog ?? null
  const meals = useMemo(() => screen?.meals ?? EMPTY_MEALS, [screen])
  const loggedMealTypes = new Set(meals.map((m) => m.mealType).filter(Boolean))
  const feedback = screen?.derived.feedback ?? null
  const habitForStreak = screen
    ? habitMetricsForStreak(
        screen.dailyLog,
        screen.derived,
        screen.latestFallback,
      )
    : null
  const currentStreak = habitForStreak?.currentStreak ?? 0

  const totalCalories = dailyLog?.totalCalories ?? 0
  const remaining = calorieTarget - totalCalories
  const progressPct = calorieTarget > 0 ? (totalCalories / calorieTarget) * 100 : 0
  const isFinalized = dailyLog?.isFinalized ?? false
  const mealCount = dailyLog?.mealCount ?? 0

  const { totalProteinG, totalCarbsG, totalFatG } = useMemo(() => {
    const allItems = meals.flatMap((m) => m.items ?? [])
    return {
      totalProteinG: allItems.reduce((s, i) => s + (i.proteinGSnapshot ?? 0) * i.quantity, 0),
      totalCarbsG: allItems.reduce((s, i) => s + (i.carbsGSnapshot ?? 0) * i.quantity, 0),
      totalFatG: allItems.reduce((s, i) => s + (i.fatGSnapshot ?? 0) * i.quantity, 0),
    }
  }, [meals])

  const proteinTargetG = Math.round(calorieTarget * 0.25 / 4)
  const carbsTargetG = Math.round(calorieTarget * 0.45 / 4)
  const fatTargetG = Math.round(calorieTarget * 0.30 / 9)

  const todayDate = getTodayInTimezone(timezone)
  const isViewingPastDay = logDate < todayDate

  const handleMealCreated = useCallback(
    (result: MealMutationResult) => {
      setCreaturePreviewState({ date: logDate, preview: mapCreaturePreviewPayload(result.creature_preview ?? null) })
      setBattlePrepState({ date: logDate, summary: null })
      invalidateDailyLog(logDate)
    },
    [logDate, invalidateDailyLog],
  )

  const { finalizing, finalizeError, finalizeDay } = useFinalizeDay({
    logDate,
    onSuccess: (result) => {
      setCreaturePreviewState({ date: logDate, preview: null })
      setBattlePrepState({ date: logDate, summary: mapBattlePrepPayload(result.battle_prep ?? null) })
      invalidateDailyLog(logDate)
    },
  })
  const { repeating, repeatError, handleRepeatLastMeal } = useRepeatLastMealAction({
    logDate,
    mealType: currentMealType,
    onSuccess: (result) => handleMealCreated(result),
  })

  const onAddToSlot = useCallback((type: MealType) => {
    setQuickAddLoggedAt(new Date().toISOString())
    setAddToSlotType(type)
    setShowQuickAdd(true)
  }, [])

  const onUpdateSuccess = useCallback(
    (result: MealMutationResult) => {
      setCreaturePreviewState({ date: logDate, preview: mapCreaturePreviewPayload(result.creature_preview ?? null) })
      setBattlePrepState({ date: logDate, summary: null })
    },
    [logDate],
  )

  const onDeleteSuccess = useCallback(
    (meal: Meal, result: DeleteMealResult) => {
      setCreaturePreviewState({ date: logDate, preview: mapCreaturePreviewPayload(result.creature_preview ?? null) })
      setBattlePrepState({ date: logDate, summary: null })
      showUndo({
        label: 'Meal deleted',
        undo: async () => {
          await restoreMealFromSnapshot(
            logDate,
            meal.loggedAt,
            buildMealSnapshotItems(meal),
            meal.mealType,
            meal.mealName,
          )
          invalidateDailyLog(logDate)
        },
      })
    },
    [logDate, showUndo, invalidateDailyLog],
  )

  const creaturePreview = creaturePreviewState?.date === logDate ? creaturePreviewState.preview : null
  const battlePrep = battlePrepState?.date === logDate ? battlePrepState.summary : null

  const dateHeaderProps: DailyLogDateHeaderProps = useMemo(
    () => ({
      logDate,
      todayDate,
      isFinalized,
      currentStreak,
      onNavigate: (nextDate: string) => navigate(`/app/log/${nextDate}`),
    }),
    [logDate, todayDate, isFinalized, currentStreak, navigate],
  )

  const summaryCardProps: DailyLogSummaryCardProps = useMemo(
    () => ({
      remaining,
      consumed: totalCalories,
      progressPct,
      totalProteinG,
      totalCarbsG,
      totalFatG,
      proteinTargetG,
      carbsTargetG,
      fatTargetG,
    }),
    [
      remaining,
      totalCalories,
      progressPct,
      totalProteinG,
      totalCarbsG,
      totalFatG,
      proteinTargetG,
      carbsTargetG,
      fatTargetG,
    ],
  )

  return {
    screenQuery,
    logDate,
    screen,
    timezone,
    feedback,
    isFinalized,
    meals,
    dateHeaderProps,
    summaryCardProps,
    creaturePreview,
    battlePrep,
    mealCount,
    isViewingPastDay,
    currentMealType,
    isEveningOrLater,
    loggedMealTypes,
    showQuickAdd,
    setShowQuickAdd,
    addToSlotType,
    setAddToSlotType,
    quickAddLoggedAt,
    finalizing,
    finalizeError,
    finalizeDay,
    repeating,
    repeatError,
    handleRepeatLastMeal,
    onAddToSlot,
    onUpdateSuccess,
    onDeleteSuccess,
    handleMealCreated,
    undoAction,
    clearUndo,
  }
}
