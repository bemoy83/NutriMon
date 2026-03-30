import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useDailyLog } from '@/features/logging/useDailyLog'
import { useInvalidateDailyLog } from '@/features/logging/useDailyLog'
import MealList from '@/features/logging/MealList'
import QuickAddSheet from '@/features/logging/QuickAddSheet'
import MealEditSheet from '@/features/logging/MealEditSheet'
import { getTodayInTimezone, isToday } from '@/lib/date'
import type { Meal } from '@/types/domain'
import { buildMealSnapshotItems, buildMealUpdateItems } from '@/features/logging/mealPayloads'
import { deleteMeal, restoreMealFromSnapshot, updateMealWithItems } from '@/features/logging/api'
import type { MealMutationResult } from '@/types/database'
import InlineQuickAdd from '@/features/logging/InlineQuickAdd'
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

export default function DailyLogPage() {
  const { date } = useParams<{ date: string }>()
  if (!date) throw new Error('No date param')
  const logDate = date
  const navigate = useNavigate()
  const profileQuery = useProfileSummary()
  const timezone = profileQuery.data?.timezone ?? 'UTC'
  const calorieTarget = profileQuery.data?.calorieTarget ?? 0

  const { data, isLoading } = useDailyLog(logDate)
  const invalidateDailyLog = useInvalidateDailyLog()
  const canRepeatLastMealQuery = useCanRepeatLastMeal(logDate)

  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null)
  const { undoAction, showUndo, clearUndo } = useUndoToast()

  const totalCalories = data?.dailyLog?.totalCalories ?? 0
  const remaining = calorieTarget - totalCalories
  const progressPct = calorieTarget > 0 ? (totalCalories / calorieTarget) * 100 : 0
  const isFinalized = data?.dailyLog?.isFinalized ?? false
  const mealCount = data?.dailyLog?.mealCount ?? 0
  const currentStreak =
    data?.habitMetrics?.currentStreak ??
    data?.fallbackHabitMetrics?.currentStreak ??
    0

  // Macro totals from meal item snapshots
  const allItems = (data?.meals ?? []).flatMap((m) => m.items ?? [])
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

  if (isLoading || profileQuery.isLoading) {
    return <LoadingState fullScreen />
  }

  const loggedAt = new Date().toISOString()

  return (
    <div className="app-page flex min-h-full flex-col pb-24">
      <DailyLogHeader
        logDate={logDate}
        todayDate={todayDate}
        isFinalized={isFinalized}
        totalCalories={totalCalories}
        calorieTarget={calorieTarget}
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
      {data?.feedback && isFinalized && (
        <div className="app-card mx-4 mt-4 p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl mt-0.5">
              {data.feedback.status === 'optimal' ? '🌟' :
               data.feedback.status === 'acceptable' ? '👍' :
               data.feedback.status === 'poor' ? '💪' : '📝'}
            </span>
            <div>
              <p className="text-[var(--app-text-primary)] text-sm">{data.feedback.message}</p>
              <p className="text-[var(--app-text-muted)] text-xs mt-1">{data.feedback.recommendation}</p>
            </div>
          </div>
        </div>
      )}

      {/* Quick-add content for empty unfinalized days */}
      {!isFinalized && mealCount === 0 && (
        <div className="px-4 mt-4">
          <InlineQuickAdd
                logDate={logDate}
            loggedAt={new Date().toISOString()}
            onCreated={(result) => handleMealCreated(result)}
          />
        </div>
      )}

      {/* Meals */}
      <div className="px-4 mt-4 space-y-3 flex-1">
        {mealCount > 0 && (
          <MealList
            meals={data?.meals ?? []}
            isFinalized={isFinalized}
            timezone={timezone}
              logDate={logDate}
            onEditMeal={setEditingMeal}
            onDeleteSuccess={(meal) => {
              showUndo({
                label: 'Meal deleted',
                undo: async () => {
                  await restoreMealFromSnapshot(logDate, meal.loggedAt, buildMealSnapshotItems(meal))
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
              className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-[var(--app-brand)] text-xl text-white shadow-md transition-colors hover:bg-[var(--app-brand-hover)]"
              aria-label="Add meal"
            >
              +
            </button>
          </div>
        </div>
      )}

      {/* Quick add sheet */}
      {showQuickAdd && (
        <QuickAddSheet
            logDate={logDate}
          loggedAt={loggedAt}
          onClose={() => setShowQuickAdd(false)}
          onAdded={(result) => handleMealCreated(result)}
        />
      )}

      {/* Meal edit sheet */}
      {editingMeal && (
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
