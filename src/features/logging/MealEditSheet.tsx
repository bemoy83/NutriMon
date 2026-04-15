import { useState, useDeferredValue } from 'react'
import { useInvalidateDailyLog } from './useDailyLog'
import type { FoodSource, Meal } from '@/types/domain'
import { updateMealWithItems } from './api'
import { useFoodSourceSearch, useRecentFoodSources } from './useFoodSources'
import { useInvalidateProductQueries } from './queryInvalidation'
import BottomSheet from '@/components/ui/BottomSheet'
import EmptyState from '@/components/ui/EmptyState'
import FoodSourceBadge from '@/components/ui/FoodSourceBadge'
import GramInput from '@/components/ui/GramInput'
import MealTypeSelector from '@/components/ui/MealTypeSelector'
import SegmentedTabs from '@/components/ui/SegmentedTabs'
import { getDefaultMealType, MEAL_TYPES } from '@/lib/mealType'
import type { MealType } from '@/lib/mealType'
import type { MealMutationResult } from '@/types/database'

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
  onSaved: (previousMeal: Meal, result: MealMutationResult) => void
}

export default function MealEditSheet({ meal, logDate, onClose, onSaved }: Props) {
  const invalidateDailyLog = useInvalidateDailyLog()
  const invalidateProducts = useInvalidateProductQueries()
  const [saving, setSaving] = useState(false)
  const [itemsOpen, setItemsOpen] = useState(true)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [mealType, setMealType] = useState<MealType>(() => {
    if (meal.mealType && MEAL_TYPES.includes(meal.mealType as MealType)) {
      return meal.mealType as MealType
    }
    return getDefaultMealType(meal.loggedAt)
  })
  const [mealName, setMealName] = useState(() => meal.mealName ?? '')

  const deferredSearchQuery = useDeferredValue(searchQuery)

  const recentQuery = useRecentFoodSources()
  const searchQuery_ = useFoodSourceSearch(deferredSearchQuery)
  const [searchTab, setSearchTab] = useState<'recent' | 'search'>('recent')

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

  function getSourceType(item: EditItem): 'user_product' | 'catalog_item' | null {
    if (item.foodSource) return item.foodSource.sourceType
    if (item.productId) return 'user_product'
    if (item.catalogItemId) return 'catalog_item'
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

  function removeFoodSource(foodSource: FoodSource) {
    setItems((prev) =>
      prev.filter((i) =>
        foodSource.sourceType === 'user_product'
          ? i.productId !== foodSource.sourceId
          : i.catalogItemId !== foodSource.sourceId,
      ),
    )
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
  }

  async function handleSave() {
    const previousMeal = meal
    setSaving(true)
    setSaveError(null)

    try {
      const result = await updateMealWithItems(
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
      }, result)
      onClose()
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save meal')
    } finally {
      setSaving(false)
    }
  }

  const totalKcal = items.reduce((sum, item) => sum + Math.round(item.quantity * getCalories(item)), 0)

  const activeFoodSources: FoodSource[] =
    searchTab === 'recent' ? recentQuery.data ?? [] : searchQuery_.data ?? []

  return (
    <BottomSheet
      onClose={onClose}
      title="Edit meal"
      className="h-[85vh] sm:h-[580px]"
      footer={
        <>
          {saveError ? <p className="px-0 pb-2 text-xs text-[var(--app-danger)]">{saveError}</p> : null}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-none px-5 py-2.5 text-sm font-medium text-[var(--app-text-muted)] rounded-lg border border-[var(--app-border)] transition-colors hover:text-[var(--app-text-primary)] hover:border-[var(--app-text-subtle)]"
            >
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
      {/* Meal name */}
      <div className="px-4 py-3 border-b border-[var(--app-border)]">
        <input
          type="text"
          value={mealName}
          onChange={(e) => setMealName(e.target.value)}
          placeholder="Meal name (optional)"
          className="app-input px-3 py-2 text-sm"
        />
      </div>

      {/* Meal type */}
      <MealTypeSelector value={mealType} onChange={setMealType} />

      {/* Items section header — toggle */}
      <button
        type="button"
        onClick={() => setItemsOpen((o) => !o)}
        className="relative z-[1] flex min-h-[44px] w-full items-center justify-between bg-[rgb(255_255_255/0.85)] px-4 py-2 border-y border-[var(--app-border)] shadow-[0_4px_14px_-4px_rgb(15_23_42_/_0.07)] transition-colors hover:bg-[var(--app-hover-overlay)]"
        aria-expanded={itemsOpen}
      >
        <span className="text-[10px] font-semibold tracking-widest uppercase text-[var(--app-text-subtle)]">
          {items.length} item{items.length !== 1 ? 's' : ''}{items.length > 0 ? <> · <span className="font-bold">{totalKcal} kcal</span></> : ''}
        </span>
        <svg
          className={`h-4 w-4 flex-none text-[var(--app-text-subtle)] transition-transform duration-200 ${itemsOpen ? '' : 'rotate-180'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      </button>

      {/* Items section — collapsible */}
      {itemsOpen && (
        <div className="max-h-[35vh] overflow-y-auto">
          {items.length === 0 ? (
            <EmptyState title="No items yet" className="py-4" />
          ) : (
            <div className="px-4 py-1 space-y-0">
              {items.map((item, idx) => {
                const servingAmount = item.snapshotServingAmount ?? 100
                const grams = Math.round(item.quantity * servingAmount)
                const sourceType = getSourceType(item)
                return (
                  <div key={idx} className="flex items-center gap-2 border-b border-[var(--app-border-muted)] last:border-0">
                    <button
                      type="button"
                      onClick={() => updateGrams(idx, 0)}
                      className="flex-none h-11 w-11 flex items-center justify-center text-[var(--app-text-subtle)] hover:text-[var(--app-danger)] transition-colors"
                      aria-label={`Remove ${getLabel(item)}`}
                    >
                      ✕
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {sourceType && <FoodSourceBadge sourceType={sourceType} />}
                        <p className="text-[var(--app-text-primary)] text-sm truncate">{getLabel(item)}</p>
                      </div>
                      <p className="text-[var(--app-text-muted)] text-xs">
                        {Math.round(item.quantity * getCalories(item))} kcal
                      </p>
                    </div>
                    <GramInput grams={grams} onChange={(g) => updateGrams(idx, g)} showSteppers={false} />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Add food section header */}
      <div className="relative z-[1] bg-[rgb(255_255_255/0.85)] px-4 py-2 border-y border-[var(--app-border)] shadow-[0_4px_14px_-4px_rgb(15_23_42_/_0.07)]">
        <span className="text-[10px] font-semibold tracking-widest uppercase text-[var(--app-text-subtle)]">Add food</span>
      </div>

      {/* Food browser tabs */}
      <SegmentedTabs
        value={searchTab}
        options={[
          { value: 'recent', label: 'Recent' },
          { value: 'search', label: 'Search' },
        ]}
        onChange={(t) => {
          setSearchTab(t)
          if (t !== 'search') setSearchQuery('')
        }}
      />

      {/* Search input */}
      <div className={`px-4${searchTab !== 'search' ? ' h-0 overflow-hidden py-0' : ' py-2'}`}>
        <input
          type="text"
          autoFocus={searchTab === 'search'}
          tabIndex={searchTab !== 'search' ? -1 : undefined}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search foods…"
          className="app-input px-3 py-2 text-sm"
        />
      </div>
      {searchTab === 'search' && searchQuery_.isPending && deferredSearchQuery.trim().length > 0 && (
        <div className="px-4 py-3 text-sm text-[var(--app-text-muted)]">Searching…</div>
      )}
      {searchTab === 'search' &&
        !searchQuery_.isPending &&
        deferredSearchQuery.trim().length > 0 &&
        (searchQuery_.data?.length ?? 0) === 0 && <EmptyState title="No foods found" className="py-4" />}

      {/* Food source list */}
      <div className="flex-1 overflow-y-auto">
        {activeFoodSources.map((foodSource: FoodSource) => {
          const isAdded = items.some((i) =>
            foodSource.sourceType === 'user_product'
              ? i.productId === foodSource.sourceId
              : i.catalogItemId === foodSource.sourceId,
          )
          return (
            <div
              key={getFoodSourceKey(foodSource)}
              className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--app-hover-overlay)] active:bg-[var(--app-hover-overlay)] transition-colors"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <FoodSourceBadge sourceType={foodSource.sourceType} />
                <div className="min-w-0">
                  <p className="text-[var(--app-text-primary)] text-sm truncate">{foodSource.name}</p>
                  <p className="text-[var(--app-text-muted)] text-xs">{foodSource.calories} kcal / {foodSource.defaultServingAmount ?? 100}{foodSource.defaultServingUnit ?? 'g'}</p>
                </div>
              </div>
              {isAdded ? (
                <button
                  type="button"
                  onClick={() => removeFoodSource(foodSource)}
                  className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[var(--app-brand)] text-white transition-colors hover:bg-[var(--app-brand-hover)] active:bg-[var(--app-brand-hover)]"
                  aria-label={`Remove ${foodSource.name} from meal`}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => addFoodSource(foodSource)}
                  className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[rgb(0_0_0/0.06)] text-[var(--app-text-muted)] transition-colors hover:bg-[rgb(0_0_0/0.10)] hover:text-[var(--app-text-primary)] border border-[var(--app-border)]"
                  aria-label={`Add ${foodSource.name}`}
                >
                  +
                </button>
              )}
            </div>
          )
        })}
      </div>
    </BottomSheet>
  )
}
