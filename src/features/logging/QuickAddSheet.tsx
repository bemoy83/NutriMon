import { useState, useEffect, useDeferredValue } from 'react'
import { useInvalidateDailyLog } from './useDailyLog'
import { createMealWithItems, deleteMealTemplate } from './api'
import type { FoodSource, MealTemplate, Product } from '@/types/domain'
import ProductForm from './ProductForm'
import type { MealMutationResult } from '@/types/database'
import { useFoodSourceSearch, useRecentFoodSources } from './useFoodSources'
import { useInvalidateMealTemplates, useInvalidateProductQueries } from './queryInvalidation'
import { useMealTemplates } from './useMealTemplates'
import BottomSheet from '@/components/ui/BottomSheet'
import EmptyState from '@/components/ui/EmptyState'
import FoodSourceBadge from '@/components/ui/FoodSourceBadge'
import GramInput from '@/components/ui/GramInput'
import MealTypeSelector from '@/components/ui/MealTypeSelector'
import SegmentedTabs from '@/components/ui/SegmentedTabs'
import { getDefaultMealType, getMealTypeTheme } from '@/lib/mealType'

interface PendingItem {
  foodSource: FoodSource
  grams: number
}

interface Props {
  logDate: string
  loggedAt: string
  onClose: () => void
  onAdded: (result: MealMutationResult) => void
}

export default function QuickAddSheet({ logDate, loggedAt, onClose, onAdded }: Props) {
  const [tab, setTab] = useState<'recent' | 'search' | 'saved' | 'create'>('recent')
  const [searchQuery, setSearchQuery] = useState('')
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([])
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [mealType, setMealType] = useState(() => getDefaultMealType(loggedAt))
  const [cartOpen, setCartOpen] = useState(false)
  const invalidateDailyLog = useInvalidateDailyLog()
  const invalidateProducts = useInvalidateProductQueries()
  const invalidateTemplates = useInvalidateMealTemplates()

  useEffect(() => {
    if (pendingItems.length === 0) setCartOpen(false)
  }, [pendingItems.length])

  const deferredSearchQuery = useDeferredValue(searchQuery)

  const recentQuery = useRecentFoodSources()
  const searchQuery_ = useFoodSourceSearch(deferredSearchQuery)
  const templatesQuery = useMealTemplates()

  function getFoodSourceKey(foodSource: FoodSource): string {
    return `${foodSource.sourceType}:${foodSource.sourceId}`
  }

  function productToFoodSource(product: Product): FoodSource {
    return {
      sourceType: 'user_product',
      sourceId: product.id,
      name: product.name,
      calories: product.calories,
      proteinG: product.proteinG,
      carbsG: product.carbsG,
      fatG: product.fatG,
      defaultServingAmount: product.defaultServingAmount,
      defaultServingUnit: product.defaultServingUnit,
      useCount: product.useCount,
      lastUsedAt: product.lastUsedAt,
    }
  }

  function addPendingItem(foodSource: FoodSource) {
    setPendingItems((prev) => {
      const existing = prev.find((i) => getFoodSourceKey(i.foodSource) === getFoodSourceKey(foodSource))
      if (existing) return prev
      return [...prev, { foodSource, grams: foodSource.defaultServingAmount ?? 100 }]
    })
  }

  function updateGrams(foodSourceKey: string, grams: number) {
    if (grams <= 0) {
      setPendingItems((prev) => prev.filter((i) => getFoodSourceKey(i.foodSource) !== foodSourceKey))
    } else {
      setPendingItems((prev) =>
        prev.map((i) => (getFoodSourceKey(i.foodSource) === foodSourceKey ? { ...i, grams } : i)),
      )
    }
  }

  async function handleConfirm() {
    if (pendingItems.length === 0) return
    setAdding(true)
    setAddError(null)

    try {
      const result = await createMealWithItems(
        logDate,
        loggedAt,
        pendingItems.map((item) => ({
          ...(item.foodSource.sourceType === 'user_product'
            ? { product_id: item.foodSource.sourceId }
            : { catalog_item_id: item.foodSource.sourceId }),
          quantity: item.grams / (item.foodSource.defaultServingAmount ?? 100),
        })),
        mealType,
      )
      invalidateDailyLog(logDate)
      invalidateProducts()
      onAdded(result)
      onClose()
    } catch (error) {
      setAddError(error instanceof Error ? error.message : 'Unable to add meal')
    } finally {
      setAdding(false)
    }
  }

  async function handleLogTemplate(template: MealTemplate) {
    setAdding(true)
    setAddError(null)
    try {
      const items = template.items
        .filter((i) => i.productId || i.catalogItemId)
        .map((i) => ({
          ...(i.productId ? { product_id: i.productId } : { catalog_item_id: i.catalogItemId! }),
          quantity: i.quantity,
        }))
      if (items.length === 0) throw new Error('Template has no usable items')
      const result = await createMealWithItems(
        logDate,
        loggedAt,
        items,
        template.defaultMealType ?? mealType,
        template.name,
        template.id,
      )
      invalidateDailyLog(logDate)
      invalidateProducts()
      invalidateTemplates()
      onAdded(result)
      onClose()
    } catch (error) {
      setAddError(error instanceof Error ? error.message : 'Unable to log template')
    } finally {
      setAdding(false)
    }
  }

  async function handleDeleteTemplate(templateId: string) {
    try {
      await deleteMealTemplate(templateId)
      invalidateTemplates()
    } catch {
      // silently ignore
    }
  }

  const activeProducts: FoodSource[] =
    tab === 'recent' ? recentQuery.data ?? [] : tab === 'search' ? searchQuery_.data ?? [] : []

  const mealTheme = getMealTypeTheme(mealType)

  const totalKcal = pendingItems.reduce(
    (sum, i) =>
      sum + Math.round((i.grams / (i.foodSource.defaultServingAmount ?? 100)) * i.foodSource.calories),
    0,
  )

  return (
    <>
    <BottomSheet
      onClose={onClose}
      title="Add meal"
      className="h-[85vh] sm:h-[580px]"
      footer={
        <>
          {pendingItems.length === 0 && (
            <p className="text-xs text-center text-[var(--app-text-subtle)] pb-2">Tap a food to add it</p>
          )}
          {addError ? <p className="pb-2 text-xs text-[var(--app-danger)]">{addError}</p> : null}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={pendingItems.length === 0 || adding}
            className="app-button-primary w-full py-2.5"
          >
            {adding
              ? 'Adding…'
              : pendingItems.length > 0
                ? `Add ${pendingItems.length} item${pendingItems.length !== 1 ? 's' : ''} to log`
                : 'Add to log'}
          </button>
        </>
      }
    >
      {/* Meal type selector */}
      <div className="bg-[rgb(255_255_255/0.85)] border-b border-[var(--app-border-muted)]">
        <MealTypeSelector value={mealType} onChange={setMealType} />
      </div>

      {/* Tabs */}
      <SegmentedTabs
        value={tab}
        options={[
          { value: 'recent', label: 'Recent' },
          { value: 'search', label: 'Search' },
          { value: 'saved', label: 'Saved' },
          { value: 'create', label: 'Create' },
        ]}
        onChange={(nextTab) => {
          setTab(nextTab)
          if (nextTab !== 'search') setSearchQuery('')
        }}
      />

      {/* Search input */}
      <div className={`px-4${tab !== 'search' ? ' h-0 overflow-hidden py-0' : ' py-2'}`}>
        <input
          type="text"
          autoFocus={tab === 'search'}
          tabIndex={tab !== 'search' ? -1 : undefined}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search foods…"
          className="app-input px-3 py-2 text-sm"
        />
      </div>
      {tab === 'search' && searchQuery_.isPending && deferredSearchQuery.trim().length > 0 && (
        <div className="px-4 py-3 text-sm text-[var(--app-text-muted)]">Searching…</div>
      )}
      {tab === 'search' &&
        !searchQuery_.isPending &&
        deferredSearchQuery.trim().length > 0 &&
        (searchQuery_.data?.length ?? 0) === 0 && <EmptyState title="No foods found" className="py-4" />}

      {/* Create tab — inline ProductForm */}
      {tab === 'create' && (
        <div className="flex-1 overflow-y-auto">
          <ProductForm
            onSave={() => {
              invalidateProducts()
              setTab('recent')
            }}
            onSaveAndAdd={(product) => {
              addPendingItem(productToFoodSource(product))
              invalidateProducts()
              setTab('recent')
            }}
            onCancel={() => setTab('recent')}
          />
        </div>
      )}

      {/* Saved templates */}
      {tab === 'saved' && (
        <div className="flex-1 overflow-y-auto">
          {(templatesQuery.data ?? []).length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-[var(--app-text-muted)]">No saved meals yet.</p>
              <p className="mt-1 text-xs text-[var(--app-text-subtle)]">
                Save a meal from the meal card to reuse it here.
              </p>
            </div>
          ) : (
            (templatesQuery.data ?? []).map((template) => (
              <TemplateRow
                key={template.id}
                template={template}
                loading={adding}
                onLog={() => handleLogTemplate(template)}
                onDelete={() => handleDeleteTemplate(template.id)}
              />
            ))
          )}
        </div>
      )}

      {/* Product list */}
      {tab !== 'saved' && tab !== 'create' && (
        <div className="flex-1 overflow-y-auto">
          {activeProducts.map((foodSource: FoodSource) => {
            const isAdded = pendingItems.some(
              (i) => getFoodSourceKey(i.foodSource) === getFoodSourceKey(foodSource),
            )
            return (
              <ProductRow
                key={getFoodSourceKey(foodSource)}
                foodSource={foodSource}
                isAdded={isAdded}
                onAdd={() => addPendingItem(foodSource)}
                onRemove={() => updateGrams(getFoodSourceKey(foodSource), 0)}
              />
            )
          })}
        </div>
      )}
    </BottomSheet>

    {pendingItems.length > 0 && (
      <div className="fixed inset-x-0 bottom-20 z-[51] border-t border-[var(--app-border)] bg-[rgb(255_255_255/0.92)] backdrop-blur-xl sm:inset-x-auto sm:left-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2">
        {/* Cart bar — handle at top, rises as items expand below */}
        <button
          type="button"
          onClick={() => setCartOpen((o) => !o)}
          className={`flex w-full items-center justify-between px-4 py-3 transition-colors${cartOpen ? ' border-b border-[var(--app-border)]' : ''}`}
          style={{
            background: mealTheme ? mealTheme.bg : 'var(--app-brand-soft)',
            color: mealTheme ? mealTheme.text : 'var(--app-brand)',
          }}
          aria-expanded={cartOpen}
          aria-label={`${pendingItems.length} item${pendingItems.length !== 1 ? 's' : ''} selected, ${totalKcal} kcal — ${cartOpen ? 'collapse' : 'expand'} cart`}
        >
          <span className="text-sm font-medium">
            {pendingItems.length} item{pendingItems.length !== 1 ? 's' : ''} · <span className="font-semibold">{totalKcal} kcal</span>
          </span>
          <svg
            className={`h-4 w-4 flex-none transition-transform duration-200 ${cartOpen ? '' : 'rotate-180'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>

        {/* Items — revealed below cart bar when open */}
        <div
          className="overflow-y-auto"
          style={{
            maxHeight: cartOpen ? '12rem' : '0',
            transition: 'max-height 300ms ease-in-out',
          }}
        >
          {pendingItems.map((item) => {
                const kcal = Math.round((item.grams / (item.foodSource.defaultServingAmount ?? 100)) * item.foodSource.calories)
                return (
                  <div key={getFoodSourceKey(item.foodSource)} className="flex items-center gap-2 px-4 border-b border-[var(--app-border-muted)] last:border-0">
                    <button
                      type="button"
                      onClick={() => updateGrams(getFoodSourceKey(item.foodSource), 0)}
                      className="flex-none h-11 w-11 flex items-center justify-center text-[var(--app-text-subtle)] hover:text-[var(--app-danger)] transition-colors"
                      aria-label={`Remove ${item.foodSource.name}`}
                    >
                      ✕
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <FoodSourceBadge sourceType={item.foodSource.sourceType} />
                        <p className="text-sm truncate text-[var(--app-text-primary)]">{item.foodSource.name}</p>
                      </div>
                      <p className="text-xs text-[var(--app-text-muted)]">{kcal} kcal</p>
                    </div>
                    <GramInput
                      grams={item.grams}
                      onChange={(g) => updateGrams(getFoodSourceKey(item.foodSource), g)}
                      showSteppers={false}
                    />
                  </div>
                )
              })}
        </div>
      </div>
    )}
    </>
  )
}

function TemplateRow({
  template,
  loading,
  onLog,
  onDelete,
}: {
  template: MealTemplate
  loading: boolean
  onLog: () => void
  onDelete: () => void
}) {
  const estimatedCalories = template.items.reduce(
    (sum, i) => sum + Math.round(i.quantity * i.caloriesSnapshot),
    0,
  )
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--app-border-muted)] hover:bg-[var(--app-hover-overlay)] active:bg-[var(--app-hover-overlay)] transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-[var(--app-text-primary)] text-sm font-medium truncate">{template.name}</p>
        <p className="text-[var(--app-text-muted)] text-xs">
          {template.items.length} item{template.items.length !== 1 ? 's' : ''} · ~{estimatedCalories} kcal
          {template.defaultMealType && <span className="ml-1">· {template.defaultMealType}</span>}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onDelete}
          className="text-[var(--app-text-subtle)] hover:text-[var(--app-danger)] transition-colors text-xs px-1.5 py-1"
          aria-label="Delete template"
        >
          ✕
        </button>
        <button
          onClick={onLog}
          disabled={loading}
          className="app-button-primary px-3 py-1.5 text-xs disabled:opacity-50"
        >
          Log
        </button>
      </div>
    </div>
  )
}

function ProductRow({
  foodSource,
  isAdded,
  onAdd,
  onRemove,
}: {
  foodSource: FoodSource
  isAdded: boolean
  onAdd: () => void
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--app-hover-overlay)] active:bg-[var(--app-hover-overlay)] transition-colors">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <FoodSourceBadge sourceType={foodSource.sourceType} />
        <div className="min-w-0">
          <p className="text-[var(--app-text-primary)] text-sm truncate">{foodSource.name}</p>
          <p className="text-[var(--app-text-muted)] text-xs">
            {foodSource.calories} kcal
            {foodSource.defaultServingAmount && foodSource.defaultServingUnit
              ? ` / ${foodSource.defaultServingAmount}${foodSource.defaultServingUnit}`
              : ' / 100g'}
          </p>
        </div>
      </div>

      {isAdded ? (
        <button
          type="button"
          onClick={onRemove}
          className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[var(--app-brand)] text-white transition-colors hover:bg-[var(--app-brand-hover)] active:bg-[var(--app-brand-hover)]"
          aria-label={`Remove ${foodSource.name} from meal`}
          title="Remove from meal"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </button>
      ) : (
        <button
          onClick={onAdd}
          className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[rgb(0_0_0/0.06)] text-[var(--app-text-muted)] transition-colors hover:bg-[rgb(0_0_0/0.10)] hover:text-[var(--app-text-primary)] border border-[var(--app-border)]"
          aria-label={`Add ${foodSource.name}`}
        >
          +
        </button>
      )}
    </div>
  )
}
