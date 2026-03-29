import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useDailyLog } from '@/features/logging/useDailyLog'
import { useInvalidateDailyLog } from '@/features/logging/useDailyLog'
import MealList from '@/features/logging/MealList'
import QuickAddSheet from '@/features/logging/QuickAddSheet'
import MealEditSheet from '@/features/logging/MealEditSheet'
import { useAuth } from '@/app/providers/auth'
import { supabase } from '@/lib/supabase'
import { formatDisplayDate, addDays, getTodayInTimezone, isToday } from '@/lib/date'
import type { Meal } from '@/types/domain'
import { useQuery } from '@tanstack/react-query'
import { UNDO_TOAST_DURATION } from '@/lib/constants'
import { buildMealSnapshotItems, buildMealUpdateItems } from '@/features/logging/mealPayloads'
import { deleteMeal, repeatLastMeal, restoreMealFromSnapshot, updateMealWithItems } from '@/features/logging/api'
import type { MealMutationResult } from '@/types/database'
import InlineQuickAdd from '@/features/logging/InlineQuickAdd'

function useProfile() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['profile', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('timezone, calorie_target')
        .eq('user_id', user!.id)
        .single()
      return data
    },
  })
}

interface UndoAction {
  label: string
  undo: () => Promise<void>
}

function useCanRepeatLastMeal(date: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['repeat-last-meal-available', user?.id, date],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_logs')
        .select('id')
        .eq('user_id', user!.id)
        .lt('log_date', date)
        .gt('meal_count', 0)
        .limit(1)

      if (error) throw error
      return (data ?? []).length > 0
    },
  })
}

export default function DailyLogPage() {
  const { date } = useParams<{ date: string }>()
  if (!date) throw new Error('No date param')
  const logDate = date
  const navigate = useNavigate()
  const { user } = useAuth()
  const profileQuery = useProfile()
  const timezone = profileQuery.data?.timezone ?? 'UTC'
  const calorieTarget = profileQuery.data?.calorie_target ?? 0

  const { data, isLoading } = useDailyLog(logDate)
  const invalidateDailyLog = useInvalidateDailyLog()
  const canRepeatLastMealQuery = useCanRepeatLastMeal(logDate)

  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null)
  const [finalizing, setFinalizing] = useState(false)
  const [finalizeError, setFinalizeError] = useState<string | null>(null)
  const [repeating, setRepeating] = useState(false)
  const [repeatError, setRepeatError] = useState<string | null>(null)
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const totalCalories = data?.dailyLog?.totalCalories ?? 0
  const remaining = calorieTarget - totalCalories
  const progressPct = calorieTarget > 0 ? Math.min((totalCalories / calorieTarget) * 100, 100) : 0
  const isFinalized = data?.dailyLog?.isFinalized ?? false
  const mealCount = data?.dailyLog?.mealCount ?? 0
  const currentStreak =
    data?.habitMetrics?.currentStreak ??
    data?.fallbackHabitMetrics?.currentStreak ??
    0

  const todayDate = getTodayInTimezone(timezone)
  const isCurrentDay = isToday(logDate, timezone)

  function showUndo(action: UndoAction) {
    if (undoTimer.current) clearTimeout(undoTimer.current)
    setUndoAction(action)
    undoTimer.current = setTimeout(() => setUndoAction(null), UNDO_TOAST_DURATION)
  }

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current)
    }
  }, [])

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

  async function handleFinalizeDay() {
    if (!user) return
    setFinalizing(true)
    setFinalizeError(null)

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) {
      setFinalizeError('Not authenticated')
      setFinalizing(false)
      return
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
    const resp = await fetch(`${supabaseUrl}/functions/v1/finalize-day`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ date: logDate }),
    })

    setFinalizing(false)
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Unknown error' }))
      setFinalizeError(err.error ?? 'Finalization failed')
      return
    }

    invalidateDailyLog(logDate)
  }

  async function handleRepeatLastMeal() {
    setRepeating(true)
    setRepeatError(null)

    try {
      const result = await repeatLastMeal(logDate)
      handleMealCreated(result, 'Last meal repeated')
    } catch (error) {
      setRepeatError(error instanceof Error ? error.message : 'Unable to repeat last meal')
    } finally {
      setRepeating(false)
    }
  }

  if (isLoading || profileQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-slate-400 text-sm">Loading…</div>
      </div>
    )
  }

  const loggedAt = new Date().toISOString()

  return (
    <div className="flex flex-col min-h-full bg-slate-950 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-4 pt-4 pb-3">
        {/* Date navigation */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => navigate(`/app/log/${addDays(logDate, -1)}`)}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="text-center">
            <h1 className="text-white font-semibold">{formatDisplayDate(logDate)}</h1>
            {isFinalized && (
              <span className="text-xs text-green-400">Finalized</span>
            )}
          </div>

          <button
            onClick={() => navigate(`/app/log/${addDays(logDate, 1)}`)}
            disabled={logDate >= todayDate}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-30"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Calorie summary */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-2xl font-bold text-white">{totalCalories}</p>
            <p className="text-slate-400 text-xs">consumed</p>
          </div>

          {/* Streak badge */}
          {currentStreak > 0 && (
            <div className="flex items-center gap-1.5 bg-orange-950 px-3 py-1.5 rounded-full">
              <span className="text-orange-400 text-sm font-semibold">{currentStreak}</span>
              <span className="text-orange-300 text-xs">day streak</span>
            </div>
          )}

          <div className="text-right">
            <p className={`text-2xl font-bold ${remaining < 0 ? 'text-red-400' : 'text-green-400'}`}>
              {Math.abs(remaining)}
            </p>
            <p className="text-slate-400 text-xs">
              {remaining < 0 ? 'over' : 'remaining'}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              progressPct >= 100 ? 'bg-red-500' : progressPct >= 85 ? 'bg-yellow-500' : 'bg-indigo-500'
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-slate-500 text-xs mt-1 text-right">
          Target: {calorieTarget.toLocaleString()} kcal
        </p>
      </div>

      {/* Feedback card (finalized) */}
      {data?.feedback && isFinalized && (
        <div className="mx-4 mt-4 p-4 bg-slate-800 rounded-xl border border-slate-700">
          <div className="flex items-start gap-3">
            <span className="text-2xl mt-0.5">
              {data.feedback.status === 'optimal' ? '🌟' :
               data.feedback.status === 'acceptable' ? '👍' :
               data.feedback.status === 'poor' ? '💪' : '📝'}
            </span>
            <div>
              <p className="text-white text-sm">{data.feedback.message}</p>
              <p className="text-slate-400 text-xs mt-1">{data.feedback.recommendation}</p>
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

      {/* Finalize button — only on current unfinalized day */}
            {isCurrentDay && !isFinalized && mealCount > 0 && (
        <div className="fixed bottom-20 inset-x-0 flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-sm">
            {finalizeError && (
              <p className="text-red-400 text-xs text-center mb-2">{finalizeError}</p>
            )}
            <button
              onClick={handleFinalizeDay}
              disabled={finalizing}
              className="w-full py-2.5 rounded-xl bg-green-700 hover:bg-green-600 text-white font-medium transition-colors shadow-lg disabled:opacity-50"
            >
              {finalizing ? 'Finalizing…' : 'Finalize Day'}
            </button>
          </div>
        </div>
      )}

      {/* Repeat last meal */}
      {!isFinalized && canRepeatLastMealQuery.data && (
        <div className="fixed bottom-36 right-4 z-30">
          {repeatError && (
            <p className="mb-2 max-w-[11rem] rounded-xl bg-red-950/80 px-3 py-2 text-xs text-red-300 shadow-lg">
              {repeatError}
            </p>
          )}
          <button
            onClick={handleRepeatLastMeal}
            disabled={repeating}
            className="rounded-full border border-slate-700 bg-slate-900/95 px-4 py-2 text-xs font-medium text-white shadow-lg transition-colors hover:bg-slate-800 disabled:opacity-50"
          >
            {repeating ? 'Repeating…' : 'Repeat last meal'}
          </button>
        </div>
      )}

      {/* Add button */}
      {!isFinalized && (
        <button
          onClick={() => setShowQuickAdd(true)}
          className="fixed bottom-20 right-4 w-14 h-14 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-lg flex items-center justify-center text-2xl transition-colors z-30"
          aria-label="Add meal"
        >
          +
        </button>
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
        <div className="fixed bottom-20 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2">
          <div className="flex items-center justify-between gap-3 rounded-full bg-slate-700 px-4 py-3 text-sm text-white shadow-lg">
            <span>{undoAction.label}</span>
            <button
              onClick={async () => {
                if (undoTimer.current) clearTimeout(undoTimer.current)
                setUndoAction(null)
                await undoAction.undo()
              }}
              className="font-medium text-indigo-300 transition-colors hover:text-indigo-200"
            >
              Undo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
