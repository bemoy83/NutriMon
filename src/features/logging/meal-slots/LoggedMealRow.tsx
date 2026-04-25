import { useState } from 'react'
import type { Meal } from '@/types/domain'
import { formatTime } from '@/lib/date'
import { initItemsFromMeal } from '../itemHelpers'
import { buildMealUpdateItemsFromEditableItems } from '../mealPayloads'
import { updateMealWithItems } from '../api'
import { useInvalidateDailyLog } from '../useDailyLog'
import { useInvalidateProductQueries } from '../queryInvalidation'
import type { Item } from '../types'
import type { MealMutationResult } from '@/types/database'
import ServingEditSheet from '../ServingEditSheet'
import { LoggedMealItemRow } from './LoggedMealItemRow'

export function LoggedMealRow({
  meal, isFinalized, timezone, logDate, hasDivider, showMealLabel, onUpdateSuccess,
}: {
  meal: Meal
  isFinalized: boolean
  timezone: string
  logDate: string
  hasDivider: boolean
  showMealLabel: boolean
  onUpdateSuccess: (result: MealMutationResult) => void
}) {
  const [servingEditTarget, setServingEditTarget] = useState<{ item: Item; idx: number } | null>(null)
  const invalidateDailyLog = useInvalidateDailyLog()
  const invalidateProducts = useInvalidateProductQueries()

  const items = meal.items ?? []
  const editableItems = initItemsFromMeal(meal)

  async function handleServingConfirmed(idx: number, quantity: number, compositeMode?: 'grams' | 'pieces') {
    const nextItems = editableItems.map((item, itemIdx) => (
      itemIdx === idx
        ? { ...item, quantity, compositeQuantityMode: compositeMode }
        : item
    ))
    const result = await updateMealWithItems(
      meal.id,
      meal.loggedAt,
      buildMealUpdateItemsFromEditableItems(nextItems),
      meal.mealType,
      meal.mealName,
    )
    invalidateDailyLog(logDate)
    invalidateProducts()
    onUpdateSuccess(result)
    setServingEditTarget(null)
  }

  async function handleDeleteItem(idx: number) {
    const nextItems = editableItems.filter((_, i) => i !== idx)
    const result = await updateMealWithItems(
      meal.id,
      meal.loggedAt,
      buildMealUpdateItemsFromEditableItems(nextItems),
      meal.mealType,
      meal.mealName,
    )
    invalidateDailyLog(logDate)
    invalidateProducts()
    onUpdateSuccess(result)
    setServingEditTarget(null)
  }

  return (
    <div>
      {/* Meal label — only when multiple meals share the same slot */}
      {showMealLabel && (
        <p className="px-4 pt-2.5 pb-0.5 text-[11px] font-medium" style={{ color: 'var(--app-text-muted)' }}>
          {meal.mealName ?? formatTime(meal.loggedAt, timezone)}
        </p>
      )}

      {/* Food items — tapping opens serving edit. Left border uses slot accent color. */}
      {(() => {
        return (
          <div>
            {items.map((item, idx) => (
              <div key={item.id}>
                <LoggedMealItemRow
                  item={item}
                  onClick={isFinalized ? undefined : () => {
                    const editableItem = editableItems[idx]
                    if (editableItem) setServingEditTarget({ item: editableItem, idx })
                  }}
                />
                {idx < items.length - 1 && (
                  <div className="mx-4 h-px" style={{ background: 'var(--app-border-muted)' }} />
                )}
              </div>
            ))}
          </div>
        )
      })()}

      {hasDivider && <div className="mx-4 h-px mt-1" style={{ background: 'var(--app-border-muted)' }} />}
      {servingEditTarget && (
        <ServingEditSheet
          item={servingEditTarget.item}
          idx={servingEditTarget.idx}
          onConfirm={handleServingConfirmed}
          onClose={() => setServingEditTarget(null)}
          onRemove={() => void handleDeleteItem(servingEditTarget.idx)}
          mealType={meal.mealType}
        />
      )}
    </div>
  )
}
