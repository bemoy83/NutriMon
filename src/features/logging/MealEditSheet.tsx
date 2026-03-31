import { useState } from 'react'
import { useInvalidateDailyLog } from './useDailyLog'
import type { FoodSource, Meal } from '@/types/domain'
import { updateMealWithItems } from './api'
import { useFoodSourceSearch, useFrequentFoodSources, useRecentFoodSources } from './useFoodSources'
import { useInvalidateProductQueries } from './queryInvalidation'
import BottomSheet from '@/components/ui/BottomSheet'
import EmptyState from '@/components/ui/EmptyState'
import FoodSourceBadge from '@/components/ui/FoodSourceBadge'
import GramInput from '@/components/ui/GramInput'
import MealTypeSelector from '@/components/ui/MealTypeSelector'
import SegmentedTabs from '@/components/ui/SegmentedTabs'
import { getDefaultMealType } from '@/lib/mealType'

interface EditItem {
  productId?: string
  catalogItemId?: string
  foodSource?: FoodSource
  mealItemId?: string
  snapshotName?: string
  snapshotCalories?: number
  snapshotProteinG?: number | null
  snapshotCarbsG?: number | null
  snapshotFatG?: number | null
  snapshotServingAmount?: number | null
  snapshotServingUnit?: string | null
  quantity: number
}

interface Props {
  meal: Meal
  logDate: string
  onClose: () => void
  onSaved: (previousMeal: Meal) => void
}

export default function MealEditSheet({ meal, logDate, onClose, onSaved }: Props) {
  const invalidateDailyLog = useInvalidateDailyLog()
  const invalidateProducts = useInvalidateProductQueries()
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [tab, setTab] = useState<'items' | 'add'>('items')
  const [mealType, setMealType] = useState(() => meal.mealType ?? getDefaultMealType(meal.loggedAt))
  const [mealName, setMealName] = useState(() => meal.mealName ?? '')

  const recentQuery = useRecentFoodSources()
  const frequentQuery = useFrequentFoodSources()
  const searchQuery_ = useFoodSourceSearch(searchQuery)
  const [searchTab, setSearchTab] = useState<'recent' | 'frequent' | 'search'>('recent')

  function getFoodSourceKey(foodSource: FoodSource): string {
    return `${foodSource.sourceType}:${foodSource.sourceId}`
  }

  const [items, setItems] = useState<EditItem[]>(() =>
    (meal.items ?? []).map((i): EditItem => {
      if (i.productId || i.catalogItemId) {
        return {
          productId: i.productId ?? undefined,
          catalogItemId: i.catalogItemId ?? undefined,
          snapshotName: i.productNameSnapshot,
          snapshotCalories: i.caloriesPerServingSnapshot,
          snapshotProteinG: i.proteinGSnapshot,
          snapshotCarbsG: i.carbsGSnapshot,
          snapshotFatG: i.fatGSnapshot,
          snapshotServingAmount: i.servingAmountSnapshot,
          snapshotServingUnit: i.servingUnitSnapshot,
          quantity: i.quantity,
        }
      }

      return {
        mealItemId: i.id,
        snapshotName: i.productNameSnapshot,
        snapshotCalories: i.caloriesPerServingSnapshot,
        snapshotProteinG: i.proteinGSnapshot,
        snapshotCarbsG: i.carbsGSnapshot,
        snapshotFatG: i.fatGSnapshot,
        snapshotServingAmount: i.servingAmountSnapshot,
        snapshotServingUnit: i.servingUnitSnapshot,
        quantity: i.quantity,
      }
    }),
  )

  function getLabel(item: EditItem): string {
    if (item.foodSource) return item.foodSource.name
    if (item.snapshotName && (item.productId || item.catalogItemId)) return item.snapshotName
    if (item.snapshotName) return `${item.snapshotName} (deleted)`
    return 'Unknown'
  }

  function getCalories(item: EditItem): number {
    if (item.foodSource) return item.foodSource.calories
    return item.snapshotCalories ?? 0
  }

  function getSourceBadge(item: EditItem): string | null {
    if (item.foodSource) {
      return item.foodSource.sourceType === 'user_product' ? 'My product' : 'Built-in'
    }
    if (item.productId) return 'My product'
    if (item.catalogItemId) return 'Built-in'
    return null
  }

  function updateGrams(idx: number, grams: number) {
    const item = items[idx]
    const servingAmount = item.snapshotServingAmount ?? 100
    const quantity = grams / servingAmount
    if (quantity <= 0) {
      setItems((prev) => prev.filter((_, i) => i !== idx))
    } else {
      setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, quantity } : it)))
    }
  }

  function addFoodSource(foodSource: FoodSource) {
    setItems((prev) => {
      const existing = prev.find((i) =>
        foodSource.sourceType === 'user_product'
          ? i.productId === foodSource.sourceId
          : i.catalogItemId === foodSource.sourceId,
      )
      if (existing) return prev
      return [
        ...prev,
        {
          productId: foodSource.sourceType === 'user_product' ? foodSource.sourceId : undefined,
          catalogItemId: foodSource.sourceType === 'catalog_item' ? foodSource.sourceId : undefined,
          foodSource,
          snapshotName: foodSource.name,
          snapshotCalories: foodSource.calories,
          snapshotProteinG: foodSource.proteinG,
          snapshotCarbsG: foodSource.carbsG,
          snapshotFatG: foodSource.fatG,
          snapshotServingAmount: foodSource.defaultServingAmount,
          snapshotServingUnit: foodSource.defaultServingUnit,
          quantity: 1,
        },
      ]
    })
    setTab('items')
  }

  async function handleSave() {
    const previousMeal = meal
    setSaving(true)
    setSaveError(null)

    try {
      await updateMealWithItems(
        meal.id,
        meal.loggedAt,
        items.map((item) => {
          if (item.productId) {
            return { product_id: item.productId, quantity: item.quantity }
          }

          if (item.catalogItemId) {
            return { catalog_item_id: item.catalogItemId, quantity: item.quantity }
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
        }),
        mealType,
        mealName.trim() || null,
      )

      invalidateDailyLog(logDate)
      invalidateProducts()
      onSaved({
        ...previousMeal,
        items: previousMeal.items ? previousMeal.items.map((item) => ({ ...item })) : [],
      })
      onClose()
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save meal')
    } finally {
      setSaving(false)
    }
  }

  const activeFoodSources: FoodSource[] =
    searchTab === 'recent'
      ? recentQuery.data ?? []
      : searchTab === 'frequent'
        ? frequentQuery.data ?? []
        : searchQuery_.data ?? []

  return (
    <BottomSheet
      onClose={onClose}
      title="Edit meal"
      footer={
        <>
          {saveError ? <p className="px-0 pb-2 text-xs text-[var(--app-danger)]">{saveError}</p> : null}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="app-button-secondary flex-1 py-2.5">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || items.length === 0}
              className="app-button-primary flex-1 py-2.5"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </>
      }
    >
        <div className="px-4 py-3 border-b border-[var(--app-border)]">
          <input
            type="text"
            value={mealName}
            onChange={(e) => setMealName(e.target.value)}
            placeholder="Meal name (optional)"
            className="app-input px-3 py-2 text-sm"
          />
        </div>
        <MealTypeSelector value={mealType} onChange={setMealType} />
        <SegmentedTabs
          value={tab}
          options={[
            { value: 'items', label: `Items (${items.length})` },
            { value: 'add', label: 'Add' },
          ]}
          onChange={setTab}
        />

        <div className="flex-1 overflow-y-auto">
          {tab === 'items' ? (
            <div className="p-4 space-y-2">
              {items.length === 0 && (
                <EmptyState title="No items. Switch to Add to add products." className="py-4" />
              )}
              {items.map((item, idx) => {
                const servingAmount = item.snapshotServingAmount ?? 100
                const grams = Math.round(item.quantity * servingAmount)
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[var(--app-text-primary)] text-sm truncate">{getLabel(item)}</p>
                        {getSourceBadge(item) && (
                          <FoodSourceBadge
                            sourceType={getSourceBadge(item) === 'My product' ? 'user_product' : 'catalog_item'}
                          />
                        )}
                      </div>
                      <p className="text-[var(--app-text-muted)] text-xs">
                        {Math.round(item.quantity * getCalories(item))} kcal
                      </p>
                    </div>
                    <GramInput grams={grams} onChange={(g) => updateGrams(idx, g)} />
                  </div>
                )
              })}
            </div>
          ) : (
            <div>
              <SegmentedTabs
                value={searchTab}
                options={[
                  { value: 'recent', label: 'Recent' },
                  { value: 'frequent', label: 'Frequent' },
                  { value: 'search', label: 'Search' },
                ]}
                onChange={setSearchTab}
              />
              {searchTab === 'search' && (
                <div className="px-4 py-2">
                  <input
                    type="text"
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search foods…"
                    className="app-input px-3 py-2 text-sm"
                  />
                </div>
              )}
              {activeFoodSources.map((foodSource: FoodSource) => (
                <button
                  key={getFoodSourceKey(foodSource)}
                  onClick={() => addFoodSource(foodSource)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--app-surface-elevated)] transition-colors text-left"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[var(--app-text-primary)] text-sm">{foodSource.name}</p>
                      <FoodSourceBadge sourceType={foodSource.sourceType} />
                    </div>
                    <p className="text-[var(--app-text-muted)] text-xs">{foodSource.calories} kcal</p>
                  </div>
                  <span className="text-[var(--app-brand)] text-lg">+</span>
                </button>
              ))}
            </div>
          )}
        </div>
    </BottomSheet>
  )
}
