import { useDeferredValue, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/app/providers/auth'
import BottomSheet from '@/components/ui/BottomSheet'
import GramInput from '@/components/ui/GramInput'
import SegmentedTabs from '@/components/ui/SegmentedTabs'
import FoodSourceBadge from '@/components/ui/FoodSourceBadge'
import { getUserProducts } from '@/features/foods/api'
import { useFoodSourceSearch } from '@/features/logging/useFoodSources'
import type { FoodSource, Product } from '@/types/domain'
import type { DraftIngredientRow } from './CompositeFoodSheet'

// ─── Types ───────────────────────────────────────────────────────────────────

interface IngredientPickerSheetProps {
  onClose: () => void
  onAdd: (ingredient: DraftIngredientRow) => void
  excludeProductIds?: string[]
}

type Tab = 'my-foods' | 'catalog'

interface SelectedItem {
  sourceType: 'product' | 'catalog'
  sourceId: string
  name: string
  caloriesPer100g: number
  proteinPer100g: number | null
  carbsPer100g: number | null
  fatPer100g: number | null
}

const TAB_OPTIONS = [
  { label: 'My foods', value: 'my-foods' as const },
  { label: 'Catalog', value: 'catalog' as const },
] as const

// ─── Helpers ─────────────────────────────────────────────────────────────────

function derivePer100g(
  value: number | null,
  servingAmount: number | null,
): number | null {
  if (value == null || !servingAmount || servingAmount <= 0) return null
  return (value / servingAmount) * 100
}

function productToSelectable(p: Product): SelectedItem | null {
  const amt = p.defaultServingAmount
  if (!amt || amt <= 0) return null
  return {
    sourceType: 'product',
    sourceId: p.id,
    name: p.name,
    caloriesPer100g: (p.calories / amt) * 100,
    proteinPer100g: derivePer100g(p.proteinG, amt),
    carbsPer100g: derivePer100g(p.carbsG, amt),
    fatPer100g: derivePer100g(p.fatG, amt),
  }
}

function foodSourceToSelectable(fs: FoodSource): SelectedItem | null {
  const amt = fs.defaultServingAmount
  if (!amt || amt <= 0) return null
  return {
    sourceType: 'catalog',
    sourceId: fs.sourceId,
    name: fs.name,
    caloriesPer100g: (fs.calories / amt) * 100,
    proteinPer100g: derivePer100g(fs.proteinG, amt),
    carbsPer100g: derivePer100g(fs.carbsG, amt),
    fatPer100g: derivePer100g(fs.fatG, amt),
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function IngredientPickerSheet({
  onClose,
  onAdd,
  excludeProductIds = [],
}: IngredientPickerSheetProps) {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('my-foods')
  const [searchQuery, setSearchQuery] = useState('')
  const [selected, setSelected] = useState<SelectedItem | null>(null)
  const [massG, setMassG] = useState(100)

  const deferredQuery = useDeferredValue(searchQuery)

  // ─── Data sources ─────────────────────────────────────────────────────────

  // My foods: simple products with unit = 'g'
  const myProductsQuery = useQuery({
    queryKey: ['my-food-products', user?.id],
    enabled: !!user,
    queryFn: () => getUserProducts(user!.id),
  })

  const myFoodsFiltered = useMemo(() => {
    const all = (myProductsQuery.data ?? []).filter(
      (p) =>
        p.kind === 'simple' &&
        p.defaultServingUnit === 'g' &&
        p.defaultServingAmount != null &&
        p.defaultServingAmount > 0,
    )
    const q = deferredQuery.trim().toLowerCase()
    const searched = q ? all.filter((p) => p.name.toLowerCase().includes(q)) : all
    return searched
  }, [myProductsQuery.data, deferredQuery])

  // Catalog: search via existing RPC
  const catalogSearch = useFoodSourceSearch(tab === 'catalog' ? deferredQuery : '')

  const catalogFiltered = useMemo(() => {
    return (catalogSearch.data ?? []).filter(
      (fs) =>
        fs.sourceType === 'catalog_item' &&
        fs.defaultServingUnit === 'g' &&
        fs.defaultServingAmount != null &&
        fs.defaultServingAmount > 0,
    )
  }, [catalogSearch.data])

  // ─── Selection handling ───────────────────────────────────────────────────

  function handleSelectProduct(product: Product) {
    const item = productToSelectable(product)
    if (!item) return
    setSelected(item)
    setMassG(100)
  }

  function handleSelectCatalog(fs: FoodSource) {
    const item = foodSourceToSelectable(fs)
    if (!item) return
    setSelected(item)
    setMassG(100)
  }

  function handleConfirm() {
    if (!selected || massG <= 0) return
    onAdd({
      key: crypto.randomUUID(),
      sourceType: selected.sourceType,
      sourceId: selected.sourceId,
      name: selected.name,
      massG,
      caloriesPer100g: selected.caloriesPer100g,
      proteinPer100g: selected.proteinPer100g,
      carbsPer100g: selected.carbsPer100g,
      fatPer100g: selected.fatPer100g,
    })
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  // If an item is selected, show the mass input sub-view
  if (selected) {
    const previewCal = (selected.caloriesPer100g * massG) / 100
    return (
      <BottomSheet
        onClose={() => setSelected(null)}
        title="Set amount"
        footer={
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="app-button-secondary flex-1 py-2.5"
            >
              Back
            </button>
            <button
              type="button"
              disabled={massG <= 0}
              onClick={handleConfirm}
              className="app-button-primary flex-1 py-2.5"
            >
              Add
            </button>
          </div>
        }
      >
        <div className="p-4 space-y-4">
          <p className="text-sm font-medium text-[var(--app-text-primary)]">
            {selected.name}
          </p>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[var(--app-text-muted)]">Amount:</span>
            <GramInput grams={massG} onChange={setMassG} step={10} />
          </div>
          <p className="text-sm text-[var(--app-text-muted)]">
            {Math.round(previewCal)} kcal for {massG}g
          </p>
        </div>
      </BottomSheet>
    )
  }

  return (
    <BottomSheet onClose={onClose} title="Add ingredient" className="max-h-[80vh]">
      <SegmentedTabs options={TAB_OPTIONS} value={tab} onChange={setTab} />

      <div className="px-4 pt-2 pb-1">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={tab === 'my-foods' ? 'Search my foods' : 'Search catalog'}
          className="app-input px-3 py-2 text-sm w-full"
          autoFocus
        />
      </div>

      <div className="overflow-y-auto px-4 pb-4">
        {tab === 'my-foods' && (
          <>
            {myFoodsFiltered.length === 0 ? (
              <p className="text-xs text-[var(--app-text-muted)] py-6 text-center">
                {deferredQuery.trim()
                  ? 'No matching simple foods with gram servings.'
                  : 'No simple foods with gram servings yet.'}
              </p>
            ) : (
              <div className="space-y-1 pt-1">
                {myFoodsFiltered.map((product) => {
                  const excluded = excludeProductIds.includes(product.id)
                  return (
                    <button
                      key={product.id}
                      type="button"
                      disabled={excluded}
                      onClick={() => handleSelectProduct(product)}
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left transition-colors ${
                        excluded
                          ? 'opacity-40 cursor-not-allowed'
                          : 'hover:bg-[var(--app-surface-elevated)]'
                      }`}
                    >
                      <FoodSourceBadge sourceType="user_product" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-[var(--app-text-primary)] truncate">
                          {product.name}
                        </p>
                        <p className="text-xs text-[var(--app-text-muted)]">
                          {product.calories} kcal / {product.defaultServingAmount}g
                        </p>
                      </div>
                      {excluded && (
                        <span className="text-[10px] text-[var(--app-text-muted)]">Added</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}

        {tab === 'catalog' && (
          <>
            {deferredQuery.trim().length === 0 ? (
              <p className="text-xs text-[var(--app-text-muted)] py-6 text-center">
                Type to search the food catalog.
              </p>
            ) : catalogFiltered.length === 0 ? (
              <p className="text-xs text-[var(--app-text-muted)] py-6 text-center">
                No matching catalog items with gram servings.
              </p>
            ) : (
              <div className="space-y-1 pt-1">
                {catalogFiltered.map((fs) => (
                  <button
                    key={fs.sourceId}
                    type="button"
                    onClick={() => handleSelectCatalog(fs)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[var(--app-surface-elevated)]"
                  >
                    <FoodSourceBadge sourceType="catalog_item" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-[var(--app-text-primary)] truncate">
                        {fs.name}
                      </p>
                      <p className="text-xs text-[var(--app-text-muted)]">
                        {fs.calories} kcal / {fs.defaultServingAmount}g
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </BottomSheet>
  )
}
