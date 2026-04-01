import { lazy, Suspense, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useInvalidateDailyLog } from '@/features/logging/useDailyLog'
import { useDailyLogCore } from '@/features/logging/useDailyLogCore'
import { useDailyLogDerived } from '@/features/logging/useDailyLogDerived'
import { useLatestFallbackMetrics } from '@/features/logging/useLatestFallbackMetrics'
import MealList from '@/features/logging/MealList'
import { getTodayInTimezone, isToday } from '@/lib/date'
import type { Meal } from '@/types/domain'
import { buildMealSnapshotItems, buildMealUpdateItems } from '@/features/logging/mealPayloads'
import { deleteMeal, restoreMealFromSnapshot, updateMealWithItems } from '@/features/logging/api'
import type { MealMutationResult } from '@/types/database'
import { useCanRepeatLastMeal } from '@/features/logging/useCanRepeatLastMeal'
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
  const canRepeatLastMealQuery = useCanRepeatLastMeal(logDate)

  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null)
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
  const isCurrentDay = isToday(logDate, timezone)
  const { finalizing, finalizeError, finalizeDay } = useFinalizeDay({
    logDate,
    onSuccess: () => invalidateDailyLog(logDate),
  })
  const { repeating, repeatError, handleRepeatLastMeal } = useRepeatLastMealAction({
    logDate,
    onSuccess: (result) => handleMealCreated(result, 'Last meal repeated'),
  })

  function handleMealCreated(result: MealMutationResult, label = 'Meal added') {
    invalidateDailyLog(logDate)
    showUndo({
      label,
      undo: async () => {
        await deleteMeal(result.meal.id)
        invalidateDailyLog(logDate)
      },
    })
  }

  if (profileQuery.isLoading || coreQuery.isLoading) {
    return <LoadingState fullScreen />
  }

  const loggedAt = new Date().toISOString()

  return (
    <div className="app-page flex min-h-full flex-col pb-24">
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

      {/* Meals */}
      <div className="px-4 mt-4 space-y-3 flex-1">
        {mealCount > 0 && (
          <MealList
            meals={meals}
            isFinalized={isFinalized}
            timezone={timezone}
            logDate={logDate}
            onEditMeal={setEditingMeal}
            onDeleteSuccess={(meal) => {
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
            {isCurrentDay && mealCount > 0 ? (
              <DailyLogFinalizeCta
                finalizing={finalizing}
                finalizeError={finalizeError}
                onFinalize={finalizeDay}
                className="flex-1"
              />
            ) : canRepeatLastMealQuery.data ? (
              <DailyLogRepeatCta
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
            onSaved={(previousMeal) => {
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
