import { useDeferredValue, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/app/providers/auth'
import BottomSheet from '@/components/ui/BottomSheet'
import FoodRow from '@/components/ui/FoodRow'
import GramInput from '@/components/ui/GramInput'
import SegmentedTabs from '@/components/ui/SegmentedTabs'
import FoodSourceBadge from '@/components/ui/FoodSourceBadge'
import ServingEstimateBlock from '@/features/logging/ServingEstimateBlock'
import { getUserProducts } from '@/features/foods/api'
import { useFoodSourceSearch } from '@/features/logging/useFoodSources'
import type { FoodSource, Product } from '@/types/domain'
import type { DraftIngredientRow } from './RecipeEditor'

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

function productCaloriesPer100gLabel(p: Product): number {
  if (p.caloriesPer100g != null && Number.isFinite(p.caloriesPer100g)) {
    return Math.round(p.caloriesPer100g)
  }
  const amt = p.defaultServingAmount
  if (!amt || amt <= 0) return 0
  return Math.round((p.calories / amt) * 100)
}

function formatMacroChip(n: number): string {
  return n < 10 ? n.toFixed(1) : String(Math.round(n))
}

function productMacroChips(p: Product) {
  if (p.proteinPer100g != null || p.carbsPer100g != null || p.fatPer100g != null) {
    return { p: p.proteinPer100g, c: p.carbsPer100g, f: p.fatPer100g }
  }
  if (p.proteinG != null || p.carbsG != null || p.fatG != null) {
    return { p: p.proteinG, c: p.carbsG, f: p.fatG }
  }
  return undefined
}

function CompositeLeadingIcon() {
  return (
    <svg className="h-4 w-4 text-[var(--app-brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 6h14M5 10h14M5 14h10" />
    </svg>
  )
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
    return q ? all.filter((p) => p.name.toLowerCase().includes(q)) : all
  }, [myProductsQuery.data, deferredQuery])

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

  function handleBack() {
    setSelected(null)
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

  const inDetail = selected !== null
  const listTranslate = inDetail ? 'translateX(-100%)' : 'translateX(0)'
  const detailTranslate = inDetail ? 'translateX(0)' : 'translateX(100%)'

  const detailEstimate = useMemo(() => {
    if (!selected) return null
    const scale = massG / 100
    return {
      kcal: Math.round((selected.caloriesPer100g * massG) / 100),
      proteinG: selected.proteinPer100g != null ? selected.proteinPer100g * scale : null,
      carbsG: selected.carbsPer100g != null ? selected.carbsPer100g * scale : null,
      fatG: selected.fatPer100g != null ? selected.fatPer100g * scale : null,
    }
  }, [selected, massG])

  return (
    <BottomSheet
      onClose={onClose}
      title={inDetail ? 'Set amount' : 'Add ingredient'}
      className="h-[80vh] sm:h-[600px]"
    >
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* Browse view */}
        <div
          className="absolute inset-0 flex flex-col transition-transform duration-[250ms] ease-out"
          aria-hidden={inDetail}
          style={{ transform: listTranslate }}
        >
          {/* Match MealSheetBrowseView: search strip, then tabs, then full-width FoodRows */}
          <div className="flex-none bg-white px-4 py-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search foods…"
              className="corner-squircle app-input box-border h-10 w-full px-4 text-sm leading-snug !rounded-[var(--app-radius-lg)]"
              autoFocus
            />
          </div>

          <SegmentedTabs
            options={TAB_OPTIONS}
            value={tab}
            onChange={setTab}
            className="!border-b !border-[var(--app-border-muted)] !bg-white !pb-3 !pt-1.5 !shadow-none"
          />

          {tab === 'catalog' && deferredQuery.trim().length > 0 && catalogSearch.isPending && (
            <div className="px-4 py-3 text-sm text-[var(--app-text-muted)]">Searching…</div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === 'my-foods' && (
              <>
                {myFoodsFiltered.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm text-[var(--app-text-muted)]">
                      {deferredQuery.trim()
                        ? 'No matching simple foods with gram servings.'
                        : 'No simple foods with gram servings yet.'}
                    </p>
                  </div>
                ) : (
                  myFoodsFiltered.map((product) => {
                    const excluded = excludeProductIds.includes(product.id)
                    const chips = productMacroChips(product)
                    const usePer100Format = Boolean(
                      product.proteinPer100g != null
                      || product.carbsPer100g != null
                      || product.fatPer100g != null,
                    )
                    return (
                      <div
                        key={product.id}
                        className={excluded ? 'pointer-events-none opacity-40' : undefined}
                      >
                        <FoodRow
                          name={product.name}
                          subtitle={`${productCaloriesPer100gLabel(product)} kcal / 100g${
                            product.labelPortionGrams
                              ? ` · label portion ${product.labelPortionGrams}g`
                              : ''
                          }`}
                          leading={<FoodSourceBadge sourceType="user_product" />}
                          isChecked={false}
                          onTap={() => handleSelectProduct(product)}
                          macroChips={chips}
                          macroFormatGrams={usePer100Format ? formatMacroChip : undefined}
                        />
                      </div>
                    )
                  })
                )}
              </>
            )}

            {tab === 'catalog' && (
              <>
                {deferredQuery.trim().length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm text-[var(--app-text-muted)]">Type to search the food catalog.</p>
                  </div>
                ) : catalogFiltered.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm text-[var(--app-text-muted)]">
                      No matching catalog items with gram servings.
                    </p>
                  </div>
                ) : (
                  catalogFiltered.map((fs) => (
                    <FoodRow
                      key={`${fs.sourceType}:${fs.sourceId}`}
                      name={fs.name}
                      subtitle={`${Math.round(fs.caloriesPer100g)} kcal / 100g${
                        fs.labelPortionGrams ? ` · label portion ${fs.labelPortionGrams}g` : ''
                      }`}
                      leading={
                        fs.kind === 'composite' ? (
                          <CompositeLeadingIcon />
                        ) : (
                          <FoodSourceBadge sourceType="catalog_item" />
                        )
                      }
                      isChecked={false}
                      onTap={() => handleSelectCatalog(fs)}
                      macroChips={
                        fs.proteinG != null || fs.carbsG != null || fs.fatG != null
                          ? { p: fs.proteinG, c: fs.carbsG, f: fs.fatG }
                          : undefined
                      }
                    />
                  ))
                )}
              </>
            )}
          </div>
        </div>

        {/* Detail view — same layout rhythm as ServingStep / recipe ingredient amount */}
        <div
          className="absolute inset-0 flex flex-col overflow-hidden transition-transform duration-[250ms] ease-out"
          aria-hidden={!inDetail}
          style={{ transform: detailTranslate }}
        >
          {selected && detailEstimate && (
            <>
              <div className="flex-none flex items-center gap-3 border-b border-[var(--app-border-muted)] px-4 py-3">
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex h-9 w-9 flex-none items-center justify-center rounded-xl text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-hover-overlay)]"
                  aria-label="Back to list"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <FoodSourceBadge
                    sourceType={selected.sourceType === 'catalog' ? 'catalog_item' : 'user_product'}
                  />
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--app-text-subtle)]">
                      Add to recipe
                    </p>
                    <p className="truncate text-sm font-semibold text-[var(--app-text-primary)]">{selected.name}</p>
                  </div>
                </div>
              </div>
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-5 pt-4">
                <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
                  <ServingEstimateBlock
                    kcal={detailEstimate.kcal}
                    proteinG={detailEstimate.proteinG}
                    carbsG={detailEstimate.carbsG}
                    fatG={detailEstimate.fatG}
                    description="For this amount in the batch"
                  />
                  <section className="pt-6">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-text-subtle)]">
                      How much?
                    </p>
                    <p className="mt-1 text-sm text-[var(--app-text-muted)]">
                      Same as logging a meal — set grams, then add to the recipe.
                    </p>
                  </section>
                  <section className="mt-auto flex flex-col items-center pb-2 pt-8">
                    <GramInput
                      grams={massG}
                      onChange={setMassG}
                      step={10}
                      showSteppers
                      size="large"
                    />
                  </section>
                </div>
              </div>
              <div className="flex-none border-t border-[var(--app-border-muted)] bg-white px-4 py-5">
                <button
                  type="button"
                  disabled={massG <= 0}
                  onClick={handleConfirm}
                  className="app-button-primary w-full py-3 !rounded-xl"
                >
                  Add to recipe
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </BottomSheet>
  )
}
