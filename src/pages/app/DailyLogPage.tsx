import { lazy, Suspense, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useInvalidateDailyLog } from '@/features/logging/useDailyLog'
import { useDailyLogCore } from '@/features/logging/useDailyLogCore'
import { useDailyLogDerived } from '@/features/logging/useDailyLogDerived'
import { useLatestFallbackMetrics } from '@/features/logging/useLatestFallbackMetrics'
import MealSlots from '@/features/logging/MealSlots'
import { getTodayInTimezone } from '@/lib/date'
import type { BattlePrepSummary, CreaturePreview, FinalizeDayResponse, Meal } from '@/types/domain'
import { buildMealSnapshotItems } from '@/features/logging/mealPayloads'
import { restoreMealFromSnapshot } from '@/features/logging/api'
import { getDefaultMealType, type MealType } from '@/lib/mealType'
import type { DeleteMealResult, MealMutationResult } from '@/types/database'
import { useRepeatLastMealPreview } from '@/features/logging/useRepeatLastMealPreview'
import { useProfileSummary } from '@/features/profile/useProfileSummary'
import { useFinalizeDay } from '@/features/logging/useFinalizeDay'
import { useRepeatLastMealAction } from '@/features/logging/useRepeatLastMealAction'
import { useUndoToast } from '@/features/logging/useUndoToast'
import {
  DailyLogCompactCard,
  DailyLogDateHeader,
  DailyLogFullCard,
  type DailyLogDateHeaderProps,
  type DailyLogSummaryCardProps,
} from '@/features/logging/DailyLogHeader'
import { useDailyLogHeaderCompact } from '@/features/logging/useDailyLogHeaderCompact'
import DailyLogFinalizeCta from '@/features/logging/DailyLogFinalizeCta'
import DailyLogRepeatCta from '@/features/logging/DailyLogRepeatCta'
import UndoToast from '@/features/logging/UndoToast'
import LoadingState from '@/components/ui/LoadingState'

const MealSheet = lazy(() => import('@/features/logging/MealSheet'))

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
  const loggedAt = new Date().toISOString()
  const currentMealType = getDefaultMealType(loggedAt)
  const isEveningOrLater = new Date().getHours() >= 17
  const repeatLastMealPreviewQuery = useRepeatLastMealPreview(logDate, currentMealType)

  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [addToSlotType, setAddToSlotType] = useState<MealType | null>(null)
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null)
  const [creaturePreviewState, setCreaturePreviewState] = useState<{ date: string; preview: CreaturePreview | null } | null>(null)
  const [battlePrepState, setBattlePrepState] = useState<{ date: string; summary: BattlePrepSummary | null } | null>(null)
  const { undoAction, showUndo, clearUndo } = useUndoToast()
  const [scrollAnchor, setScrollAnchor] = useState<HTMLDivElement | null>(null)
  const [dateSticky, setDateSticky] = useState<HTMLDivElement | null>(null)
  const [fullHeader, setFullHeader] = useState<HTMLDivElement | null>(null)
  const headerCompact = useDailyLogHeaderCompact({
    scrollAnchor,
    dateSticky,
    fullHeader,
    resetKey: logDate,
  })

  const dailyLog = coreQuery.data?.dailyLog ?? null
  const meals = coreQuery.data?.meals ?? []
  const loggedMealTypes = new Set(meals.map((m) => m.mealType).filter(Boolean))
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
  const isViewingPastDay = logDate < todayDate
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
    loggedAt,
    mealType: currentMealType,
    onSuccess: (result) => handleMealCreated(result),
  })

  function handleMealCreated(result: MealMutationResult) {
    setCreaturePreviewState({ date: logDate, preview: mapCreaturePreviewPayload(result.creature_preview ?? null) })
    setBattlePrepState({ date: logDate, summary: null })
    invalidateDailyLog(logDate)
  }
  const creaturePreview = creaturePreviewState?.date === logDate ? creaturePreviewState.preview : null
  const battlePrep = battlePrepState?.date === logDate ? battlePrepState.summary : null

  if (profileQuery.isLoading || coreQuery.isLoading) {
    return <LoadingState fullScreen />
  }

  const dateHeaderProps: DailyLogDateHeaderProps = {
    logDate,
    todayDate,
    isFinalized,
    currentStreak,
    onNavigate: (nextDate: string) => navigate(`/app/log/${nextDate}`),
  }
  const summaryCardProps: DailyLogSummaryCardProps = {
    remaining,
    consumed: totalCalories,
    progressPct,
    totalProteinG,
    totalCarbsG,
    totalFatG,
    proteinTargetG,
    carbsTargetG,
    fatTargetG,
  }

  return (
    <div ref={setScrollAnchor} className="app-page flex min-h-full flex-col pb-40">
      <div
        className="sticky top-0 z-[18] px-4 pt-2"
        style={{
          background: 'var(--app-bg)',
          boxShadow: headerCompact ? '0 10px 24px rgba(15, 23, 42, 0.08)' : 'none',
          transition: 'box-shadow 180ms ease',
        }}
      >
        <div ref={setDateSticky} className="relative z-[1]">
          <DailyLogDateHeader {...dateHeaderProps} />
        </div>
        <div
          className={`pointer-events-none absolute inset-x-0 top-full z-[1] transition-[opacity,height] duration-180 ease-out ${
            headerCompact ? 'h-32 opacity-100' : 'h-0 opacity-0'
          }`}
          style={{
            background: 'linear-gradient(to bottom, var(--app-bg) 0%, var(--app-bg) 72%, transparent 100%)',
          }}
          aria-hidden="true"
        />
        <div
          className={`pointer-events-none absolute inset-x-4 top-full z-[2] origin-top transition-[opacity,transform] duration-180 ease-out ${
            headerCompact
              ? 'translate-y-0 scale-y-100 opacity-100'
              : '-translate-y-1 scale-y-[0.96] opacity-0'
          }`}
          aria-hidden={!headerCompact}
        >
          <div className="pointer-events-auto">
            <DailyLogCompactCard {...summaryCardProps} />
          </div>
        </div>
      </div>

      <div ref={setFullHeader} className="px-4 pt-3 pb-4">
        <DailyLogFullCard {...summaryCardProps} />
      </div>

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


      {!isFinalized && creaturePreview && (
        <div className="app-card mx-4 mt-4 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--app-text-primary)]">Creature Preview</h2>
            <span className="text-xs font-semibold capitalize text-[var(--app-brand)]">{creaturePreview.mealRating}</span>
          </div>
          <p className="text-sm text-[var(--app-text-muted)]">{creaturePreview.mealFeedbackMessage}</p>
          <div className="h-px bg-[var(--app-border-muted)]" />
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--app-text-muted)]">Tomorrow readiness</span>
            <span className="text-sm text-[var(--app-text-primary)]">{creaturePreview.tomorrowReadinessScore}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--app-text-muted)]">Readiness</span>
            <span className="text-sm text-[var(--app-text-primary)] capitalize">{creaturePreview.tomorrowReadinessBand}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--app-text-muted)]">Strength</span>
            <span className="text-sm text-[var(--app-text-primary)]">{creaturePreview.projectedStrength}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--app-text-muted)]">Momentum</span>
            <span className="text-sm text-[var(--app-text-primary)]">{creaturePreview.projectedMomentum}</span>
          </div>
        </div>
      )}

      {/* Meals */}
      <div className="px-4 mt-4 flex-1">
        <h2 className="text-base font-bold mb-3" style={{ color: 'var(--app-text-primary)' }}>Meals</h2>
        <MealSlots
          meals={meals}
          isFinalized={isFinalized}
          timezone={timezone}
          logDate={logDate}
          onAddToSlot={(type) => { setAddToSlotType(type); setShowQuickAdd(true) }}
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
      </div>

      {/* Bottom action bar */}
      {!isFinalized && (
        <div className="fixed inset-x-0 bottom-0 z-[19] px-4 pt-10 pb-[5.5rem] bg-gradient-to-t from-[var(--app-bg)] via-[var(--app-bg)]/70 to-transparent">
          <div className="mx-auto max-w-lg w-full">
            {isViewingPastDay && mealCount > 0 ? (
              <DailyLogFinalizeCta
                finalizing={finalizing}
                finalizeError={finalizeError}
                onFinalize={finalizeDay}
                className="w-full"
              />
            ) : repeatLastMealPreviewQuery.data && !loggedMealTypes.has(currentMealType) ? (
              <DailyLogRepeatCta
                preview={repeatLastMealPreviewQuery.data}
                repeating={repeating}
                repeatError={repeatError}
                onRepeat={handleRepeatLastMeal}
                className="w-full"
              />
            ) : mealCount > 0 && isEveningOrLater ? (
              <DailyLogFinalizeCta
                finalizing={finalizing}
                finalizeError={finalizeError}
                onFinalize={finalizeDay}
                className="w-full"
              />
            ) : null}
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

      {/* Add meal sheet */}
      {showQuickAdd && (
        <Suspense fallback={<SheetLoadingFallback />}>
          <MealSheet
            mode="add"
            logDate={logDate}
            loggedAt={loggedAt}
            defaultMealType={addToSlotType ?? undefined}
            onClose={() => { setShowQuickAdd(false); setAddToSlotType(null) }}
            onAdded={(result) => handleMealCreated(result)}
          />
        </Suspense>
      )}

      {/* Edit meal sheet */}
      {editingMeal && (
        <Suspense fallback={<SheetLoadingFallback />}>
          <MealSheet
            mode="edit"
            meal={editingMeal}
            logDate={logDate}
            loggedAt={loggedAt}
            onClose={() => setEditingMeal(null)}
            onSaved={(_previousMeal, result) => {
              setCreaturePreviewState({ date: logDate, preview: mapCreaturePreviewPayload(result.creature_preview ?? null) })
              setBattlePrepState({ date: logDate, summary: null })
              invalidateDailyLog(logDate)
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
