import { useState } from 'react'
import { useInvalidateDailyLog } from './useDailyLog'
import { useInvalidateProducts } from './useProducts'
import type { Meal } from '@/types/domain'
import { useRecentProducts, useFrequentProducts, useProductSearch } from './useProducts'
import type { Product } from '@/types/domain'
import { updateMealWithItems } from './api'

interface EditItem {
  // For active products
  productId?: string
  product?: Product
  // For snapshot-only (deleted product) items
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
  const invalidateProducts = useInvalidateProducts()
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [tab, setTab] = useState<'items' | 'add'>('items')

  const recentQuery = useRecentProducts()
  const frequentQuery = useFrequentProducts()
  const searchQuery_ = useProductSearch(searchQuery)
  const [searchTab, setSearchTab] = useState<'recent' | 'frequent' | 'search'>('recent')

  // Initialize items from meal
  const [items, setItems] = useState<EditItem[]>(() =>
    (meal.items ?? []).map((i): EditItem => {
      if (i.productId) {
        return { productId: i.productId, quantity: i.quantity }
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
    if (item.product) return item.product.name
    if (item.snapshotName) return `${item.snapshotName} (deleted)`
    return 'Unknown'
  }

  function getCalories(item: EditItem): number {
    if (item.product) return item.product.calories
    return item.snapshotCalories ?? 0
  }

  function updateQty(idx: number, qty: number) {
    if (qty <= 0) {
      setItems((prev) => prev.filter((_, i) => i !== idx))
    } else {
      setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, quantity: qty } : item)))
    }
  }

  function addProduct(product: Product) {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id)
      if (existing) return prev
      return [...prev, { productId: product.id, product, quantity: 1 }]
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

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col bg-slate-900 rounded-t-2xl max-h-[85vh] sm:max-w-lg sm:mx-auto sm:rounded-xl sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h3 className="text-white font-semibold">Edit meal</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex border-b border-slate-700">
          <button
            onClick={() => setTab('items')}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
              tab === 'items' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-400'
            }`}
          >
            Items ({items.length})
          </button>
          <button
            onClick={() => setTab('add')}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
              tab === 'add' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-400'
            }`}
          >
            Add
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {tab === 'items' ? (
            <div className="p-4 space-y-2">
              {items.length === 0 && (
                <p className="text-slate-500 text-sm text-center py-4">
                  No items. Switch to Add to add products.
                </p>
              )}
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">{getLabel(item)}</p>
                    <p className="text-slate-400 text-xs">
                      {Math.round(item.quantity * getCalories(item))} kcal
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQty(idx, item.quantity - 0.5)}
                      className="w-7 h-7 flex items-center justify-center bg-slate-700 rounded-full text-slate-400 hover:text-white"
                    >
                      −
                    </button>
                    <span className="text-white text-sm w-8 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQty(idx, item.quantity + 0.5)}
                      className="w-7 h-7 flex items-center justify-center bg-slate-700 rounded-full text-slate-400 hover:text-white"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <div className="flex border-b border-slate-700">
                {(['recent', 'frequent', 'search'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setSearchTab(t)}
                    className={`flex-1 py-2 text-xs font-medium capitalize transition-colors ${
                      searchTab === t ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-400'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {searchTab === 'search' && (
                <div className="px-4 py-2">
                  <input
                    type="text"
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search products…"
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
              {(searchTab === 'recent'
                ? recentQuery.data
                : searchTab === 'frequent'
                  ? frequentQuery.data
                  : searchQuery_.data) ?.map((product) => (
                <button
                  key={product.id}
                  onClick={() => addProduct(product)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800 transition-colors text-left"
                >
                  <div>
                    <p className="text-white text-sm">{product.name}</p>
                    <p className="text-slate-400 text-xs">{product.calories} kcal</p>
                  </div>
                  <span className="text-indigo-400 text-lg">+</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {saveError && <p className="text-red-400 text-xs px-4 pb-2">{saveError}</p>}
        <div className="p-4 border-t border-slate-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || items.length === 0}
            className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </>
  )
}
