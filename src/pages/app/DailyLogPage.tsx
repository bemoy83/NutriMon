import { lazy, Suspense } from 'react'
import { useParams } from 'react-router-dom'
import { useDailyLogPage } from '@/features/logging/useDailyLogPage'
import MealSlots from '@/features/logging/MealSlots'
import {
  DailyLogCompactCard,
  DailyLogDateHeader,
} from '@/features/logging/DailyLogHeader'
import DailyLogFinalizeCta from '@/features/logging/DailyLogFinalizeCta'
import DailyLogRepeatCta from '@/features/logging/DailyLogRepeatCta'
import UndoToast from '@/features/logging/UndoToast'
import LoadingState from '@/components/ui/LoadingState'
import { CardTitle, SectionHeader } from '@/components/ui/AppHeadings'

const MealSheet = lazy(() => import('@/features/logging/MealSheet'))

export default function DailyLogPage() {
  const { date } = useParams<{ date: string }>()
  if (!date) throw new Error('No date param')

  const p = useDailyLogPage(date)

  if (p.screenQuery.isLoading) {
    return <LoadingState fullScreen />
  }

  return (
    <div className="app-page flex min-h-full flex-col pb-40">
      <div
        className="sticky top-0 z-[18] px-4 pt-2 pb-3"
        style={{
          background: 'var(--app-bg)',
        }}
      >
        <div className="relative z-[1]">
          <DailyLogDateHeader {...p.dateHeaderProps} />
        </div>
        <div className="mt-2">
          <DailyLogCompactCard {...p.summaryCardProps} />
        </div>
        <div
          className="pointer-events-none absolute inset-x-0 top-full h-6"
          style={{
            background: 'linear-gradient(to bottom, var(--app-bg) 0%, transparent 100%)',
          }}
          aria-hidden="true"
        />
      </div>

      {p.feedback && p.isFinalized && (
        <div className="app-card mx-4 mt-4 p-4">
          <p className="text-xs font-medium mb-3" style={{ color: 'var(--app-text-muted)' }}>Daily Summary</p>
          <div className="flex items-start gap-3">
            <span className="text-2xl mt-0.5">
              {p.feedback.status === 'optimal' ? '🌟' :
               p.feedback.status === 'acceptable' ? '👍' :
               p.feedback.status === 'poor' ? '💪' : '📝'}
            </span>
            <div>
              <p className="text-[var(--app-text-primary)] text-sm">{p.feedback.message}</p>
              <p className="text-[var(--app-text-muted)] text-xs mt-1">{p.feedback.recommendation}</p>
            </div>
          </div>
        </div>
      )}

      {!p.isFinalized && p.creaturePreview && (
        <div className="app-card mx-4 mt-4 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <CardTitle>Creature Preview</CardTitle>
            <span className="text-xs font-semibold capitalize text-[var(--app-brand)]">{p.creaturePreview.mealRating}</span>
          </div>
          <p className="text-sm text-[var(--app-text-muted)]">{p.creaturePreview.mealFeedbackMessage}</p>
          <div className="h-px bg-[var(--app-border-muted)]" />
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--app-text-muted)]">Tomorrow readiness</span>
            <span className="text-sm text-[var(--app-text-primary)]">{p.creaturePreview.tomorrowReadinessScore}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--app-text-muted)]">Readiness</span>
            <span className="text-sm text-[var(--app-text-primary)] capitalize">{p.creaturePreview.tomorrowReadinessBand}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--app-text-muted)]">Strength</span>
            <span className="text-sm text-[var(--app-text-primary)]">{p.creaturePreview.projectedStrength}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--app-text-muted)]">Momentum</span>
            <span className="text-sm text-[var(--app-text-primary)]">{p.creaturePreview.projectedMomentum}</span>
          </div>
        </div>
      )}

      <div className="px-4 mt-4 flex-1">
        <SectionHeader className="mb-3">Meals</SectionHeader>
        <MealSlots
          meals={p.meals}
          isFinalized={p.isFinalized}
          timezone={p.timezone}
          logDate={p.logDate}
          onAddToSlot={p.onAddToSlot}
          onUpdateSuccess={p.onUpdateSuccess}
          onDeleteSuccess={p.onDeleteSuccess}
        />
      </div>

      {!p.isFinalized && (
        <div className="fixed inset-x-0 bottom-0 z-[19] px-4 pt-10 pb-[5.5rem] bg-gradient-to-t from-[var(--app-bg)] via-[var(--app-bg)]/70 to-transparent">
          <div className="mx-auto max-w-lg w-full">
            {p.isViewingPastDay && p.mealCount > 0 ? (
              <DailyLogFinalizeCta
                finalizing={p.finalizing}
                finalizeError={p.finalizeError}
                onFinalize={p.finalizeDay}
                className="w-full"
              />
            ) : p.screen?.repeatLastMeal && !p.loggedMealTypes.has(p.currentMealType) ? (
              <DailyLogRepeatCta
                preview={p.screen.repeatLastMeal}
                repeating={p.repeating}
                repeatError={p.repeatError}
                onRepeat={p.handleRepeatLastMeal}
                className="w-full"
              />
            ) : p.mealCount > 0 && p.isEveningOrLater ? (
              <DailyLogFinalizeCta
                finalizing={p.finalizing}
                finalizeError={p.finalizeError}
                onFinalize={p.finalizeDay}
                className="w-full"
              />
            ) : null}
          </div>
        </div>
      )}

      {p.battlePrep && (
        <div className="app-card mx-4 mt-4 p-4">
          <p className="text-xs font-medium mb-3 text-[var(--app-text-muted)]">Tomorrow&apos;s Battle Prep</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-[var(--app-radius-lg)] bg-[var(--app-surface-muted)] px-3 py-2">
              <p className="text-xs text-[var(--app-text-muted)]">Readiness</p>
              <p className="font-semibold text-[var(--app-text-primary)]">{p.battlePrep.readinessScore}</p>
            </div>
            <div className="rounded-[var(--app-radius-lg)] bg-[var(--app-surface-muted)] px-3 py-2 capitalize">
              <p className="text-xs text-[var(--app-text-muted)]">Condition</p>
              <p className="font-semibold text-[var(--app-text-primary)]">{p.battlePrep.condition}</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-[var(--app-text-primary)] capitalize">
            {p.battlePrep.readinessBand} prep locked for {p.battlePrep.battleDate}. XP gained: {p.battlePrep.xpGained}.
          </p>
          {p.battlePrep.recommendedOpponent ? (
            <p className="mt-2 text-xs text-[var(--app-text-secondary)]">
              Recommended opponent: {p.battlePrep.recommendedOpponent.name} ({p.battlePrep.recommendedOpponent.archetype}) | {p.battlePrep.recommendedOpponent.likelyOutcome}
            </p>
          ) : (
            <p className="mt-2 text-xs text-[var(--app-text-secondary)]">
              No opponent recommendation yet. Your snapshot is still locked for tomorrow.
            </p>
          )}
        </div>
      )}

      {p.showQuickAdd && (
        <Suspense fallback={<SheetLoadingFallback />}>
          <MealSheet
            logDate={p.logDate}
            loggedAt={p.quickAddLoggedAt}
            defaultMealType={p.addToSlotType ?? undefined}
            onClose={() => { p.setShowQuickAdd(false); p.setAddToSlotType(null) }}
            onAdded={(result) => p.handleMealCreated(result)}
          />
        </Suspense>
      )}

      {p.undoAction && (
        <UndoToast
          action={p.undoAction}
          onUndo={async () => {
            const act = p.undoAction
            p.clearUndo()
            if (act) await act.undo()
          }}
        />
      )}
    </div>
  )
}

function SheetLoadingFallback() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg rounded-t-[var(--app-radius-xl)] border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-lg">
      <p className="text-sm text-[var(--app-text-muted)]">Loading…</p>
    </div>
  )
}
