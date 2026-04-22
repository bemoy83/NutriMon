import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import LoadingState from '@/components/ui/LoadingState'
import MealTypeSelector from '@/components/ui/MealTypeSelector'
import MealSheet from '@/features/logging/MealSheet'
import ServingEditSheet from '@/features/logging/ServingEditSheet'
import { deleteMeal, updateMealWithItems } from '@/features/logging/api'
import {
  getItemKey,
  getItemKcal,
  getItemLabel,
  initItemsFromMeal,
} from '@/features/logging/itemHelpers'
import type { DailyLogMealEditState } from '@/features/logging/mealEditNavigation'
import type { Item } from '@/features/logging/types'
import { useInvalidateProductQueries } from '@/features/logging/queryInvalidation'
import { useInvalidateDailyLog } from '@/features/logging/useDailyLog'
import { useDailyLogCore } from '@/features/logging/useDailyLogCore'
import { getDefaultMealType, MEAL_TYPES, type MealType } from '@/lib/mealType'

function resolveMealType(mealType: string | null | undefined, loggedAt: string): MealType {
  if (mealType && MEAL_TYPES.includes(mealType as MealType)) return mealType as MealType
  return getDefaultMealType(loggedAt)
}

function formatAmount(value: number): string {
  return Number.isInteger(value) ? String(value) : parseFloat(value.toFixed(2)).toString()
}

function getItemServingLabel(item: Item): string {
  if (item.compositeQuantityMode === 'pieces') {
    const pieceUnit = item.foodSource?.pieceLabel
      ?? (item.snapshotServingUnit && item.snapshotServingUnit !== 'g' ? item.snapshotServingUnit : 'pc')
    return `${formatAmount(item.quantity)} ${pieceUnit}`
  }
  return `${Math.round(item.quantity * 100)}g`
}

function mergeItems(previous: Item[], incoming: Item[]): Item[] {
  return incoming.reduce<Item[]>((next, item) => {
    if (!item.productId && !item.catalogItemId) {
      return [...next, item]
    }
    const existingIndex = next.findIndex((candidate) =>
      item.productId
        ? candidate.productId === item.productId
        : candidate.catalogItemId === item.catalogItemId,
    )
    if (existingIndex === -1) return [...next, item]
    return next.map((candidate, index) => (
      index === existingIndex ? item : candidate
    ))
  }, previous)
}

export default function MealEditPage() {
  const { date, mealId } = useParams<{ date: string; mealId: string }>()
  if (!date || !mealId) throw new Error('Missing meal edit route params')

  const navigate = useNavigate()
  const invalidateDailyLog = useInvalidateDailyLog()
  const invalidateProducts = useInvalidateProductQueries()
  const coreQuery = useDailyLogCore(date)
  const meal = (coreQuery.data?.meals ?? []).find((candidate) => candidate.id === mealId) ?? null

  const [items, setItems] = useState<Item[]>([])
  const [mealName, setMealName] = useState('')
  const [mealType, setMealType] = useState<MealType>(getDefaultMealType(new Date().toISOString()))
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [servingEditTarget, setServingEditTarget] = useState<{ item: Item; idx: number } | null>(null)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const hydratedMealIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!meal) return
    if (hydratedMealIdRef.current === meal.id) return
    setItems(initItemsFromMeal(meal))
    setMealName(meal.mealName ?? '')
    setMealType(resolveMealType(meal.mealType, meal.loggedAt))
    setSubmitError(null)
    hydratedMealIdRef.current = meal.id
  }, [meal])

  if (coreQuery.isLoading) return <LoadingState fullScreen />
  if (!meal) return <Navigate to={`/app/log/${date}`} replace />

  function handleServingConfirmed(idx: number, quantity: number, compositeMode?: 'grams' | 'pieces') {
    setItems((prev) => prev.map((it, i) => (
      i === idx ? { ...it, quantity, compositeQuantityMode: compositeMode } : it
    )))
    setServingEditTarget(null)
  }

  function handleDeleteItem(idx: number) {
    setItems((prev) => prev.filter((_, index) => index !== idx))
    setServingEditTarget((current) => {
      if (!current) return null
      if (current.idx === idx) return null
      if (current.idx > idx) return { ...current, idx: current.idx - 1 }
      return current
    })
  }

  async function handleSave() {
    if (!meal || items.length === 0 || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const apiItems = items.map((item) => {
        if (item.productId) {
          return {
            product_id: item.productId,
            quantity: item.quantity,
            ...(item.compositeQuantityMode && { composite_quantity_mode: item.compositeQuantityMode }),
          }
        }
        if (item.catalogItemId) {
          return {
            catalog_item_id: item.catalogItemId,
            quantity: item.quantity,
            ...(item.compositeQuantityMode && { composite_quantity_mode: item.compositeQuantityMode }),
          }
        }
        return {
          meal_item_id: item.mealItemId,
          quantity: item.quantity,
          product_name_snapshot: item.snapshotName,
          calories_per_serving_snapshot: item.snapshotCalories,
          protein_g_snapshot: item.snapshotProteinG,
          carbs_g_snapshot: item.snapshotCarbsG,
          fat_g_snapshot: item.snapshotFatG,
          serving_amount_snapshot: item.snapshotServingAmount,
          serving_unit_snapshot: item.snapshotServingUnit,
        }
      })

      const result = await updateMealWithItems(
        meal.id,
        meal.loggedAt,
        apiItems,
        mealType,
        mealName.trim() || null,
      )
      invalidateDailyLog(date)
      invalidateProducts()
      const state: DailyLogMealEditState = {
        mealEditAction: {
          kind: 'saved',
          logDate: date,
          result,
        },
      }
      navigate(`/app/log/${date}`, { state })
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to update meal')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteMeal() {
    if (!meal || deleting) return
    const label = meal.mealName ?? meal.mealType ?? 'this meal'
    if (!window.confirm(`Delete "${label}"?`)) return

    setDeleting(true)
    setSubmitError(null)
    try {
      const result = await deleteMeal(meal.id)
      invalidateDailyLog(date)
      invalidateProducts()
      const state: DailyLogMealEditState = {
        mealEditAction: {
          kind: 'deleted',
          logDate: date,
          result,
          deletedMeal: meal,
        },
      }
      navigate(`/app/log/${date}`, { state })
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to delete meal')
      setDeleting(false)
    }
  }

  return (
    <div className="flex h-full flex-col bg-[var(--app-bg)]">
      <div className="flex-none flex items-center gap-2 px-4 py-3 bg-white border-b border-[var(--app-border-muted)]">
        <button
          type="button"
          onClick={() => navigate(`/app/log/${date}`)}
          className="flex-none h-9 w-9 flex items-center justify-center rounded-full hover:bg-[var(--app-hover-overlay)] transition-colors text-[var(--app-text-muted)]"
          aria-label="Back to daily log"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="flex-1 text-base font-semibold text-[var(--app-text-primary)] truncate">Edit meal</h1>
        <button
          type="button"
          disabled={submitting || items.length === 0}
          onClick={handleSave}
          className="app-button-primary px-4 py-2 text-sm"
        >
          {submitting ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-4 pt-4">
          <input
            type="text"
            value={mealName}
            onChange={(e) => setMealName(e.target.value)}
            placeholder="Meal name (optional)"
            className="app-input w-full px-3 py-2 text-sm"
          />
        </div>

        <div className="pt-4 bg-white">
          <div className="px-4 pb-1">
            <p className="text-[10px] font-semibold tracking-widest uppercase text-[var(--app-text-subtle)]">
              Meal type
            </p>
          </div>
          <MealTypeSelector value={mealType} onChange={setMealType} />
        </div>

        <div className="mt-4 border-t border-[var(--app-border-muted)] bg-white">
          {items.length > 0 ? (
            items.map((item, idx) => (
              <div
                key={getItemKey(item)}
                className="flex items-center gap-3 px-4 py-3 border-b border-[var(--app-border-muted)] last:border-b-0"
              >
                <button
                  type="button"
                  onClick={() => setServingEditTarget({ item, idx })}
                  className="flex-1 min-w-0 text-left hover:bg-[var(--app-hover-overlay)] rounded-xl px-1 py-1 transition-colors"
                >
                  <p className="text-sm font-medium text-[var(--app-text-primary)] truncate">{getItemLabel(item)}</p>
                  <p className="text-xs text-[var(--app-text-muted)]">
                    {getItemServingLabel(item)} · {getItemKcal(item)} kcal
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteItem(idx)}
                  className="flex-none h-9 w-9 flex items-center justify-center rounded-full text-[var(--app-text-subtle)] hover:text-[var(--app-danger)] hover:bg-[var(--app-hover-overlay)] transition-colors"
                  aria-label={`Delete ${getItemLabel(item)}`}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))
          ) : (
            <p className="px-4 py-6 text-sm text-[var(--app-text-muted)]">Add at least one food to save this meal.</p>
          )}

          <button
            type="button"
            onClick={() => setShowAddSheet(true)}
            className="flex w-full items-center gap-3 px-4 py-3 text-sm text-[var(--app-text-muted)] hover:text-[var(--app-brand)] hover:bg-[var(--app-hover-overlay)] transition-colors"
          >
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-dashed border-[var(--app-border)] text-lg leading-none">
              +
            </span>
            <span>Add food</span>
          </button>
        </div>

        {submitError && (
          <p className="px-4 pt-4 text-sm text-[var(--app-danger)]">{submitError}</p>
        )}
      </div>

      <div className="flex-none px-4 pt-4 pb-20 bg-white border-t border-[var(--app-border-muted)]">
        <button
          type="button"
          disabled={deleting}
          onClick={handleDeleteMeal}
          className="app-button-danger w-full py-2.5 text-sm"
        >
          {deleting ? 'Deleting…' : 'Delete meal'}
        </button>
      </div>

      {servingEditTarget && (
        <ServingEditSheet
          item={servingEditTarget.item}
          idx={servingEditTarget.idx}
          onConfirm={handleServingConfirmed}
          onClose={() => setServingEditTarget(null)}
        />
      )}

      {showAddSheet && (
        <MealSheet
          logDate={date}
          loggedAt={meal.loggedAt}
          defaultMealType={mealType}
          onClose={() => setShowAddSheet(false)}
          onItemsSelected={(newItems) => {
            setItems((prev) => mergeItems(prev, newItems))
            setShowAddSheet(false)
          }}
        />
      )}
    </div>
  )
}
