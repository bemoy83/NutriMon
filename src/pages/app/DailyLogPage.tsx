import { lazy, Suspense, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useInvalidateDailyLog } from '@/features/logging/useDailyLog'
import { useDailyLogCore } from '@/features/logging/useDailyLogCore'
import { useDailyLogDerived } from '@/features/logging/useDailyLogDerived'
import { useLatestFallbackMetrics } from '@/features/logging/useLatestFallbackMetrics'
import MealList from '@/features/logging/MealList'
import { getTodayInTimezone } from '@/lib/date'
import type { BattlePrepSummary, CreaturePreview, FinalizeDayResponse, Meal } from '@/types/domain'
import { buildMealSnapshotItems, buildMealUpdateItems } from '@/features/logging/mealPayloads'
import { deleteMeal, restoreMealFromSnapshot, updateMealWithItems } from '@/features/logging/api'
import type { DeleteMealResult, MealMutationResult } from '@/types/database'
import { useRepeatLastMealPreview } from '@/features/logging/useRepeatLastMealPreview'
import { useProfileSummary } from '@/features/profile/useProfileSummary'
import { useFinalizeDay } from '@/features/logging/useFinalizeDay'
import { useRepeatLastMealAction } from '@/features/logging/useRepeatLastMealAction'
import { useUndoToast } from '@/features/logging/useUndoToast'
import DailyLogHeader from '@/features/logging/DailyLogHeader'
import DailyLogFinalizeCta from '@/features/logging/DailyLogFinalizeCta'
import DailyLogRepeatCta from '@/features/logging/DailyLogRepeatCta'
import UndoToast from '@/features/logging/UndoToast'
import LoadingState from '@/components/ui/LoadingState'

const QuickAddSheet = lazy(() => import('@/features/logging/QuickAddSheet'))
const MealEditSheet = lazy(() => import('@/features/logging/MealEditSheet'))

function mapCreaturePreviewPayload(preview: MealMutationResult['creature_preview'] | DeleteMealResult['creature_preview']): CreaturePreview | null {
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

export default function DailyLogPage() {
  const { date } = useParams<{ date: string }>()
  if (!date) throw new Error('No date param')
  const logDate = date
  const navigate = useNavigate()
  const profileQuery = useProfileSummary()
  const timezone = profileQuery.data?.timezone ?? 'UTC'
  const calorieTarget = profileQuery.data?.calorieTarget ?? 0

  const coreQuery = useDailyLogCore(logDate)
  const derivedQuery = useDailyLogDerived(logDate)
  const fallbackMetricsQuery = useLatestFallbackMetrics(
    !coreQuery.isLoading &&
      !derivedQuery.isLoading &&
      (
        !(derivedQuery.data?.habitMetrics) ||
        !(derivedQuery.data?.creatureStats) ||
        !(coreQuery.data?.dailyLog?.isFinalized ?? false)
      ),
  )
  const invalidateDailyLog = useInvalidateDailyLog()
  const repeatLastMealPreviewQuery = useRepeatLastMealPreview(logDate)

  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null)
  const [creaturePreviewState, setCreaturePreviewState] = useState<{ date: string; preview: CreaturePreview | null } | null>(null)
  const [battlePrepState, setBattlePrepState] = useState<{ date: string; summary: BattlePrepSummary | null } | null>(null)
  const { undoAction, showUndo, clearUndo } = useUndoToast()

  const dailyLog = coreQuery.data?.dailyLog ?? null
  const meals = coreQuery.data?.meals ?? []
  const feedback = derivedQuery.data?.feedback ?? null
  const habitMetrics = derivedQuery.data?.habitMetrics ?? null
  const fallbackHabitMetrics = fallbackMetricsQuery.data?.habitMetrics ?? null

  const totalCalories = dailyLog?.totalCalories ?? 0
  const remaining = calorieTarget - totalCalories
  const progressPct = calorieTarget > 0 ? (totalCalories / calorieTarget) * 100 : 0
  const isFinalized = dailyLog?.isFinalized ?? false
  const mealCount = dailyLog?.mealCount ?? 0
  const currentStreak =
    habitMetrics?.currentStreak ??
    fallbackHabitMetrics?.currentStreak ??
    0

  // Macro totals from meal item snapshots
  const allItems = meals.flatMap((m) => m.items ?? [])
  const totalProteinG = allItems.reduce((s, i) => s + (i.proteinGSnapshot ?? 0) * i.quantity, 0)
  const totalCarbsG = allItems.reduce((s, i) => s + (i.carbsGSnapshot ?? 0) * i.quantity, 0)
  const totalFatG = allItems.reduce((s, i) => s + (i.fatGSnapshot ?? 0) * i.quantity, 0)

  // Macro targets derived from calorie target (AMDR midpoints)
  const proteinTargetG = Math.round(calorieTarget * 0.25 / 4)
  const carbsTargetG = Math.round(calorieTarget * 0.45 / 4)
  const fatTargetG = Math.round(calorieTarget * 0.30 / 9)

  const todayDate = getTodayInTimezone(timezone)
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
    onSuccess: (result) => handleMealCreated(result, 'Previous meal copied'),
  })

  function handleMealCreated(result: MealMutationResult, label = 'Meal added') {
    setCreaturePreviewState({ date: logDate, preview: mapCreaturePreviewPayload(result.creature_preview ?? null) })
    setBattlePrepState({ date: logDate, summary: null })
    invalidateDailyLog(logDate)
    showUndo({
      label,
      undo: async () => {
        await deleteMeal(result.meal.id)
        invalidateDailyLog(logDate)
      },
    })
  }
  const creaturePreview = creaturePreviewState?.date === logDate ? creaturePreviewState.preview : null
  const battlePrep = battlePrepState?.date === logDate ? battlePrepState.summary : null

  if (profileQuery.isLoading || coreQuery.isLoading) {
    return <LoadingState fullScreen />
  }

  const loggedAt = new Date().toISOString()

  return (
    <div className="app-page flex min-h-full flex-col pb-40">
      <DailyLogHeader
        logDate={logDate}
        todayDate={todayDate}
        isFinalized={isFinalized}
        remaining={remaining}
        progressPct={progressPct}
        currentStreak={currentStreak}
        totalProteinG={totalProteinG}
        totalCarbsG={totalCarbsG}
        totalFatG={totalFatG}
        proteinTargetG={proteinTargetG}
        carbsTargetG={carbsTargetG}
        fatTargetG={fatTargetG}
        onNavigate={(nextDate) => navigate(`/app/log/${nextDate}`)}
      />

      {/* Feedback card (finalized) */}
      {feedback && isFinalized && (
        <div className="app-card mx-4 mt-4 p-4">
          <p className="text-xs font-medium mb-3" style={{ color: 'var(--app-text-muted)' }}>Daily Summary</p>
          <div className="flex items-start gap-3">
            <span className="text-2xl mt-0.5">
              {feedback.status === 'optimal' ? '🌟' :
               feedback.status === 'acceptable' ? '👍' :
               feedback.status === 'poor' ? '💪' : '📝'}
            </span>
            <div>
              <p className="text-[var(--app-text-primary)] text-sm">{feedback.message}</p>
              <p className="text-[var(--app-text-muted)] text-xs mt-1">{feedback.recommendation}</p>
            </div>
          </div>
        </div>
      )}

      {/* Empty-day prompt for unfinalized days */}
      {!isFinalized && mealCount === 0 && (
        <div className="px-4 mt-4">
          <div className="app-card p-4">
            <h2 className="text-base font-semibold text-[var(--app-text-primary)]">
              No meals logged yet.
            </h2>
            <p className="mt-1 text-sm text-[var(--app-text-muted)]">
              Tap + to add your first meal.
            </p>
          </div>
        </div>
      )}

      {!isFinalized && creaturePreview && (
        <div className="app-card mx-4 mt-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--app-text-muted)]">
                Creature Preview
              </p>
              <p className="mt-2 text-sm text-[var(--app-text-primary)]">{creaturePreview.mealFeedbackMessage}</p>
            </div>
            <div className="rounded-full bg-[var(--app-surface)] px-3 py-1 text-xs font-semibold capitalize text-[var(--app-brand)]">
              {creaturePreview.mealRating}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--app-text-secondary)]">
            <div className="rounded-xl bg-[var(--app-surface)] px-3 py-2">
              Tomorrow readiness: <span className="font-semibold text-[var(--app-text-primary)]">{creaturePreview.tomorrowReadinessScore}</span>
            </div>
            <div className="rounded-xl bg-[var(--app-surface)] px-3 py-2 capitalize">
              Readiness: <span className="font-semibold text-[var(--app-text-primary)]">{creaturePreview.tomorrowReadinessBand}</span>
            </div>
            <div className="rounded-xl bg-[var(--app-surface)] px-3 py-2">
              Strength {creaturePreview.projectedStrength}
            </div>
            <div className="rounded-xl bg-[var(--app-surface)] px-3 py-2">
              Momentum {creaturePreview.projectedMomentum}
            </div>
          </div>
        </div>
      )}

      {/* Meals */}
      <div className="px-4 mt-4 space-y-3 flex-1">
        {mealCount > 0 && (
          <MealList
            meals={meals}
            isFinalized={isFinalized}
            timezone={timezone}
            logDate={logDate}
            onEditMeal={setEditingMeal}
            onDeleteSuccess={(meal, result) => {
              setCreaturePreviewState({ date: logDate, preview: mapCreaturePreviewPayload(result.creature_preview ?? null) })
              setBattlePrepState({ date: logDate, summary: null })
              showUndo({
                label: 'Meal deleted',
                undo: async () => {
                  await restoreMealFromSnapshot(logDate, meal.loggedAt, buildMealSnapshotItems(meal), meal.mealType, meal.mealName)
                  invalidateDailyLog(logDate)
                },
              })
            }}
          />
        )}
      </div>

      {/* Bottom action bar */}
      {!isFinalized && (
        <div className="fixed inset-x-0 bottom-20 z-30 px-4">
          <div className="mx-auto max-w-lg flex items-end gap-2">
            {/* Left slot: Finalize (priority) or Repeat */}
            {mealCount > 0 ? (
              <DailyLogFinalizeCta
                finalizing={finalizing}
                finalizeError={finalizeError}
                onFinalize={finalizeDay}
                className="flex-1"
              />
            ) : repeatLastMealPreviewQuery.data ? (
              <DailyLogRepeatCta
                preview={repeatLastMealPreviewQuery.data}
                repeating={repeating}
                repeatError={repeatError}
                onRepeat={handleRepeatLastMeal}
                className="flex-1"
              />
            ) : (
              <div className="flex-1" />
            )}

            {/* Add button — always anchored right */}
            <button
              onClick={() => setShowQuickAdd(true)}
              className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-[var(--app-brand)] text-white shadow-md transition-colors hover:bg-[var(--app-brand-hover)]"
              aria-label="Add meal"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {battlePrep && (
        <div className="app-card mx-4 mt-4 p-4">
          <p className="text-xs font-medium mb-3 text-[var(--app-text-muted)]">Tomorrow&apos;s Battle Prep</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl bg-[var(--app-surface-muted)] px-3 py-2">
              <p className="text-xs text-[var(--app-text-muted)]">Readiness</p>
              <p className="font-semibold text-[var(--app-text-primary)]">{battlePrep.readinessScore}</p>
            </div>
            <div className="rounded-xl bg-[var(--app-surface-muted)] px-3 py-2 capitalize">
              <p className="text-xs text-[var(--app-text-muted)]">Condition</p>
              <p className="font-semibold text-[var(--app-text-primary)]">{battlePrep.condition}</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-[var(--app-text-primary)] capitalize">
            {battlePrep.readinessBand} prep locked for {battlePrep.battleDate}. XP gained: {battlePrep.xpGained}.
          </p>
          {battlePrep.recommendedOpponent ? (
            <p className="mt-2 text-xs text-[var(--app-text-secondary)]">
              Recommended opponent: {battlePrep.recommendedOpponent.name} ({battlePrep.recommendedOpponent.archetype}) | {battlePrep.recommendedOpponent.likelyOutcome}
            </p>
          ) : (
            <p className="mt-2 text-xs text-[var(--app-text-secondary)]">
              No opponent recommendation yet. Your snapshot is still locked for tomorrow.
            </p>
          )}
        </div>
      )}

      {/* Quick add sheet */}
      {showQuickAdd && (
        <Suspense fallback={<SheetLoadingFallback />}>
          <QuickAddSheet
            logDate={logDate}
            loggedAt={loggedAt}
            onClose={() => setShowQuickAdd(false)}
            onAdded={(result) => handleMealCreated(result)}
          />
        </Suspense>
      )}

      {/* Meal edit sheet */}
      {editingMeal && (
        <Suspense fallback={<SheetLoadingFallback />}>
          <MealEditSheet
            meal={editingMeal}
            logDate={logDate}
            onClose={() => setEditingMeal(null)}
            onSaved={(previousMeal, result) => {
              setCreaturePreviewState({ date: logDate, preview: mapCreaturePreviewPayload(result.creature_preview ?? null) })
              setBattlePrepState({ date: logDate, summary: null })
              showUndo({
                label: 'Meal updated',
                undo: async () => {
                  await updateMealWithItems(previousMeal.id, previousMeal.loggedAt, buildMealUpdateItems(previousMeal))
                  invalidateDailyLog(logDate)
                },
              })
              setEditingMeal(null)
            }}
          />
        </Suspense>
      )}

      {undoAction && (
        <UndoToast
          action={undoAction}
          onUndo={async () => {
            clearUndo()
            await undoAction.undo()
          }}
        />
      )}
    </div>
  )
}

function SheetLoadingFallback() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg rounded-t-3xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-lg">
      <p className="text-sm text-[var(--app-text-muted)]">Loading…</p>
    </div>
  )
}
