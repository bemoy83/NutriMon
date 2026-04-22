import { Fragment, useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import LoadingState from '@/components/ui/LoadingState'
import FoodSourceBadge from '@/components/ui/FoodSourceBadge'
import MealTypeSelector from '@/components/ui/MealTypeSelector'
import MealSheet from '@/features/logging/MealSheet'
import ServingEditSheet from '@/features/logging/ServingEditSheet'
import { deleteMeal, updateMealWithItems } from '@/features/logging/api'
import {
  getItemKey,
  getItemKcal,
  getItemLabel,
  getItemSourceType,
  initItemsFromMeal,
} from '@/features/logging/itemHelpers'
import type { DailyLogMealEditState } from '@/features/logging/mealEditNavigation'
import type { Item } from '@/features/logging/types'
import { useInvalidateProductQueries } from '@/features/logging/queryInvalidation'
import { useFoodSourceMap } from '@/features/logging/useFoodSources'
import { useInvalidateDailyLog } from '@/features/logging/useDailyLog'
import { useDailyLogCore } from '@/features/logging/useDailyLogCore'
import { getDefaultMealType, getMealTypeTheme, MEAL_TYPES, type MealType } from '@/lib/mealType'

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

function ItemLeading({ item }: { item: Item }) {
  const sourceType = getItemSourceType(item)

  if (item.foodSource?.kind === 'composite') {
    return (
      <svg className="h-5 w-5 text-[var(--app-brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 6h14M5 10h14M5 14h10" />
      </svg>
    )
  }

  if (sourceType) {
    return <FoodSourceBadge sourceType={sourceType} />
  }

  return <div className="h-2.5 w-2.5 rounded-full bg-[var(--app-text-muted)] opacity-35" />
}

export default function MealEditPage() {
  const { date, mealId } = useParams<{ date: string; mealId: string }>()
  if (!date || !mealId) throw new Error('Missing meal edit route params')
  const logDate = date
  const editMealId = mealId

  const navigate = useNavigate()
  const invalidateDailyLog = useInvalidateDailyLog()
  const invalidateProducts = useInvalidateProductQueries()
  const coreQuery = useDailyLogCore(logDate)
  const meal = (coreQuery.data?.meals ?? []).find((candidate) => candidate.id === editMealId) ?? null

  const [items, setItems] = useState<Item[]>([])
  const [mealName, setMealName] = useState('')
  const [mealType, setMealType] = useState<MealType>(getDefaultMealType(new Date().toISOString()))
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [servingEditTarget, setServingEditTarget] = useState<{ item: Item; idx: number } | null>(null)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const hydratedMealIdRef = useRef<string | null>(null)
  const mealTheme = getMealTypeTheme(mealType)
  const totalKcal = items.reduce((sum, item) => sum + getItemKcal(item), 0)
  const missingProductIds = [...new Set(
    items
      .filter((item) => !item.foodSource && item.productId)
      .map((item) => item.productId!),
  )]
  const missingCatalogIds = [...new Set(
    items
      .filter((item) => !item.foodSource && item.catalogItemId)
      .map((item) => item.catalogItemId!),
  )]
  const sourceMapQuery = useFoodSourceMap(missingProductIds, missingCatalogIds)

  useEffect(() => {
    if (!meal) return
    if (hydratedMealIdRef.current === meal.id) return
    setItems(initItemsFromMeal(meal))
    setMealName(meal.mealName ?? '')
    setMealType(resolveMealType(meal.mealType, meal.loggedAt))
    setSubmitError(null)
    hydratedMealIdRef.current = meal.id
  }, [meal])

  useEffect(() => {
    const sourceMap = sourceMapQuery.data
    if (!sourceMap) return
    setItems((prev) => {
      let changed = false
      const next = prev.map((item) => {
        if (item.foodSource) return item
        const sourceKey = item.productId
          ? `user_product:${item.productId}`
          : item.catalogItemId
            ? `catalog_item:${item.catalogItemId}`
            : null
        if (!sourceKey) return item
        const foodSource = sourceMap[sourceKey]
        if (!foodSource) return item
        changed = true
        return { ...item, foodSource }
      })
      return changed ? next : prev
    })
  }, [sourceMapQuery.data])

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
      invalidateDailyLog(logDate)
      invalidateProducts()
      const state: DailyLogMealEditState = {
        mealEditAction: {
          kind: 'saved',
          logDate: logDate,
          result,
        },
      }
      navigate(`/app/log/${logDate}`, { state })
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
      invalidateDailyLog(logDate)
      invalidateProducts()
      const state: DailyLogMealEditState = {
        mealEditAction: {
          kind: 'deleted',
          logDate: logDate,
          result,
          deletedMeal: meal,
        },
      }
      navigate(`/app/log/${logDate}`, { state })
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to delete meal')
      setDeleting(false)
    }
  }

  return (
    <div className="app-page min-h-full pb-28">
      <div className="sticky top-0 z-10" style={{ background: 'var(--app-bg)' }}>
        <div className="flex items-center gap-2 px-4 pt-4 pb-3">
          <button
            type="button"
            onClick={() => navigate(`/app/log/${logDate}`)}
            className="flex-none h-10 w-10 flex items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-hover-overlay)]"
            aria-label="Back to daily log"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--app-text-subtle)]">
              Meal editor
            </p>
            <h1 className="truncate text-lg font-semibold text-[var(--app-text-primary)]">Edit meal</h1>
          </div>
          <button
            type="button"
            disabled={submitting || items.length === 0}
            onClick={handleSave}
            className="app-button-primary px-4 py-2 text-sm"
          >
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="px-4 pb-10">
        <div className="app-card overflow-hidden">
          <div
            className="px-4 py-4"
            style={{
              background: mealTheme
                ? `linear-gradient(135deg, ${mealTheme.bg} 0%, var(--app-surface) 100%)`
                : 'linear-gradient(135deg, var(--app-surface-elevated) 0%, var(--app-surface) 100%)',
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--app-text-subtle)]">
                  Overview
                </p>
                <h2 className="mt-1 truncate text-2xl font-bold tracking-tight text-[var(--app-text-primary)]">
                  {mealName.trim() || mealType}
                </h2>
                <p className="mt-1 text-sm text-[var(--app-text-muted)]">
                  {items.length} item{items.length !== 1 ? 's' : ''} · {totalKcal} kcal
                </p>
              </div>
              <span
                className="rounded-full px-3 py-1 text-xs font-semibold"
                style={{
                  background: mealTheme?.bg ?? 'var(--app-surface-elevated)',
                  color: mealTheme?.text ?? 'var(--app-text-secondary)',
                }}
              >
                {mealType}
              </span>
            </div>
          </div>

          <div className="border-t border-[var(--app-border-muted)] px-4 py-4">
            <label className="block">
              <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--app-text-subtle)]">
                Meal name
              </span>
              <input
                type="text"
                value={mealName}
                onChange={(e) => setMealName(e.target.value)}
                placeholder="Meal name (optional)"
                className="app-input w-full px-3 py-2 text-sm"
              />
            </label>

            <div className="mt-4 -mx-4 border-t border-[var(--app-border-muted)] pt-4">
              <div className="px-4 pb-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--app-text-subtle)]">
                  Meal type
                </p>
              </div>
              <MealTypeSelector value={mealType} onChange={setMealType} />
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between px-1">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--app-text-subtle)]">
              Foods
            </p>
            <p className="mt-1 text-sm text-[var(--app-text-muted)]">
              Tap a row to adjust serving size.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddSheet(true)}
            className="app-button-secondary px-3 py-2 text-sm"
          >
            Browse foods
          </button>
        </div>

        <div className="app-card mt-3 overflow-hidden">
          {items.length > 0 ? (
            items.map((item, idx) => (
              <Fragment key={getItemKey(item)}>
                {idx > 0 && (
                  <div aria-hidden className="mx-4 h-px bg-[var(--app-border-muted)]" />
                )}
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <button
                    type="button"
                    onClick={() => setServingEditTarget({ item, idx })}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl text-left transition-colors hover:bg-[var(--app-hover-overlay)]"
                  >
                    <div className="flex h-8 w-8 flex-none items-center justify-center">
                      <ItemLeading item={item} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--app-text-primary)]">
                        {getItemLabel(item)}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">
                        {getItemServingLabel(item)} · {getItemKcal(item)} kcal
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteItem(idx)}
                    className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[var(--app-text-subtle)] transition-colors hover:bg-[var(--app-hover-overlay)] hover:text-[var(--app-danger)]"
                    aria-label={`Delete ${getItemLabel(item)}`}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </Fragment>
            ))
          ) : (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-medium text-[var(--app-text-primary)]">No foods in this meal yet</p>
              <p className="mt-1 text-xs text-[var(--app-text-muted)]">Add at least one food to save this meal.</p>
            </div>
          )}

          {items.length > 0 && <div aria-hidden className="mx-4 h-px bg-[var(--app-border-muted)]" />}

          <button
            type="button"
            onClick={() => setShowAddSheet(true)}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-hover-overlay)] hover:text-[var(--app-brand)]"
          >
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-dashed border-[var(--app-border)] text-lg leading-none">
              +
            </span>
            <span>Add food</span>
          </button>
        </div>

        {submitError && (
          <p className="px-1 pt-4 text-sm text-[var(--app-danger)]">{submitError}</p>
        )}

        <button
          type="button"
          disabled={deleting}
          onClick={handleDeleteMeal}
          className="app-button-danger mt-6 w-full py-2.5 text-sm"
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
          logDate={logDate}
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
