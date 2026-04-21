import { useState, useDeferredValue, useEffect } from 'react'
import { useInvalidateDailyLog } from './useDailyLog'
import { createMealWithItems, deleteMealTemplate, updateMealWithItems } from './api'
import type { FoodSource, Meal, MealTemplate } from '@/types/domain'
import type { MealMutationResult } from '@/types/database'
import { useFoodSourceSearch, useRecentFoodSources } from './useFoodSources'
import { useInvalidateMealTemplates, useInvalidateProductQueries } from './queryInvalidation'
import { useMealTemplates } from './useMealTemplates'
import BottomSheet from '@/components/ui/BottomSheet'
import FoodRow from '@/components/ui/FoodRow'
import FoodSourceBadge from '@/components/ui/FoodSourceBadge'
import GramInput from '@/components/ui/GramInput'
import MealTypeSelector from '@/components/ui/MealTypeSelector'
import SegmentedTabs from '@/components/ui/SegmentedTabs'
import ProductForm from './ProductForm'
import { getDefaultMealType, getMealTypeTheme, MEAL_TYPES } from '@/lib/mealType'
import type { MealType } from '@/lib/mealType'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Item {
  productId?: string
  catalogItemId?: string
  mealItemId?: string
  foodSource?: FoodSource
  snapshotName?: string
  snapshotCalories?: number
  snapshotServingAmount?: number | null
  snapshotServingUnit?: string | null
  snapshotProteinG?: number | null
  snapshotCarbsG?: number | null
  snapshotFatG?: number | null
  quantity: number
  compositeQuantityMode?: 'grams' | 'pieces'
}

interface MealSheetProps {
  mode: 'add' | 'edit'
  logDate: string
  loggedAt: string
  onClose: () => void
  onAdded?: (result: MealMutationResult) => void
  meal?: Meal
  onSaved?: (previousMeal: Meal, result: MealMutationResult) => void
}

type SheetView = 'browse' | 'serving' | 'create'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getItemKey(item: Item): string {
  if (item.productId) return `user_product:${item.productId}`
  if (item.catalogItemId) return `catalog_item:${item.catalogItemId}`
  return `snapshot:${item.mealItemId}`
}

function getItemLabel(item: Item): string {
  if (item.foodSource) return item.foodSource.name
  if (item.snapshotName && (item.productId || item.catalogItemId)) return item.snapshotName
  if (item.snapshotName) return `${item.snapshotName} (deleted)`
  return 'Unknown'
}

function getItemCalories(item: Item): number {
  if (item.foodSource) return item.foodSource.caloriesPer100g ?? item.foodSource.calories
  return item.snapshotCalories ?? 0
}

/** Stored quantity is multiples of 100 g (grams / 100); reference divisor is always 100. */
function getItemServingAmount(): number {
  return 100
}

function getItemSourceType(item: Item): 'user_product' | 'catalog_item' | null {
  if (item.foodSource) return item.foodSource.sourceType
  if (item.productId) return 'user_product'
  if (item.catalogItemId) return 'catalog_item'
  return null
}

/** Compute kcal for a single cart item, accounting for composite piece mode. */
function getItemKcal(item: Item): number {
  if (item.compositeQuantityMode === 'pieces') {
    // quantity is piece count; derive grams per piece from food source
    const fs = item.foodSource
    if (fs && fs.totalMassG && fs.pieceCount && fs.pieceCount > 0) {
      const gramsPerPiece = fs.totalMassG / fs.pieceCount
      return Math.round(item.quantity * (fs.calories / 100) * gramsPerPiece)
    }
  }
  return Math.round(item.quantity * getItemCalories(item))
}

function initItemsFromMeal(meal: Meal): Item[] {
  return (meal.items ?? []).map((i): Item => {
    // Detect piece mode from snapshot: if serving unit is not 'g' and not null, it was piece mode
    const compositeQuantityMode: 'grams' | 'pieces' | undefined =
      i.servingUnitSnapshot && i.servingUnitSnapshot !== 'g' ? 'pieces' : undefined

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
        compositeQuantityMode,
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
      compositeQuantityMode,
    }
  })
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MealSheet({ mode, logDate, loggedAt, onClose, onAdded, meal, onSaved }: MealSheetProps) {
  const [sheetView, setSheetView] = useState<SheetView>('browse')
  const [servingTarget, setServingTarget] = useState<FoodSource | null>(null)
  const [pendingGrams, setPendingGrams] = useState(100)
  /** Integer count when logging by label portions (massInputMode === 'portions'). */
  const [pendingPortions, setPendingPortions] = useState(1)
  const [massInputMode, setMassInputMode] = useState<'grams' | 'portions'>('grams')
  const [pendingMode, setPendingMode] = useState<'grams' | 'pieces'>('grams')
  const [items, setItems] = useState<Item[]>(() =>
    mode === 'edit' && meal ? initItemsFromMeal(meal) : [],
  )
  const [cartOpen, setCartOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [tab, setTab] = useState<'recent' | 'saved'>('recent')
  const [mealType, setMealType] = useState<MealType>(() => {
    if (mode === 'edit' && meal?.mealType && MEAL_TYPES.includes(meal.mealType as MealType)) {
      return meal.mealType as MealType
    }
    return getDefaultMealType(loggedAt)
  })
  const [mealName, setMealName] = useState(mode === 'edit' ? (meal?.mealName ?? '') : '')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const invalidateDailyLog = useInvalidateDailyLog()
  const invalidateProducts = useInvalidateProductQueries()
  const invalidateTemplates = useInvalidateMealTemplates()

  const deferredSearchQuery = useDeferredValue(searchQuery)
  const recentQuery = useRecentFoodSources()
  const searchResults = useFoodSourceSearch(deferredSearchQuery)
  const templatesQuery = useMealTemplates()

  const mealTheme = getMealTypeTheme(mealType)
  const totalKcal = items.reduce((sum, i) => sum + getItemKcal(i), 0)

  // Close cart when all items are removed
  useEffect(() => {
    if (items.length === 0) setCartOpen(false)
  }, [items.length])

  // Intercept Escape in serving/create view — go back instead of closing sheet
  useEffect(() => {
    if (sheetView === 'browse') return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        setSheetView('browse')
      }
    }
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [sheetView])

  // ─── Food browser ─────────────────────────────────────────────────────────

  const isSearching = deferredSearchQuery.trim().length > 0

  const activeFoodSources: FoodSource[] = tab === 'recent'
    ? isSearching
      ? (searchResults.data ?? [])
      : (recentQuery.data ?? [])
    : []

  const visibleTemplates = (templatesQuery.data ?? []).filter((t) =>
    !isSearching || t.name.toLowerCase().includes(deferredSearchQuery.trim().toLowerCase()),
  )

  function isItemInCart(fs: FoodSource): boolean {
    return items.some(i =>
      fs.sourceType === 'user_product' ? i.productId === fs.sourceId : i.catalogItemId === fs.sourceId,
    )
  }

  function handleFoodTap(foodSource: FoodSource) {
    const existing = items.find(i =>
      foodSource.sourceType === 'user_product'
        ? i.productId === foodSource.sourceId
        : i.catalogItemId === foodSource.sourceId,
    )

    // Reset or restore composite mode
    setMassInputMode('grams')

    if (existing?.compositeQuantityMode === 'pieces') {
      setPendingMode('pieces')
      setPendingGrams(existing.quantity) // quantity IS piece count in piece mode
    } else {
      setPendingMode('grams')
      const currentGrams = existing
        ? Math.round(existing.quantity * 100)
        : (foodSource.labelPortionGrams ?? 100)
      setPendingGrams(currentGrams)
      if (foodSource.labelPortionGrams && foodSource.labelPortionGrams > 0) {
        setPendingPortions(Math.max(1, Math.round(currentGrams / foodSource.labelPortionGrams)))
      } else {
        setPendingPortions(1)
      }
    }

    setServingTarget(foodSource)
    setSheetView('serving')
  }

  // ─── Composite helpers ───────────────────────────────────────────────────

  const isCompositeWithPieces = servingTarget?.kind === 'composite'
    && (servingTarget.pieceCount ?? 0) > 0
    && (servingTarget.totalMassG ?? 0) > 0

  // ─── Serving step ─────────────────────────────────────────────────────────

  function confirmServing() {
    if (!servingTarget) return

    let quantity: number
    let compositeQuantityMode: 'grams' | 'pieces' | undefined

    if (pendingMode === 'pieces' && isCompositeWithPieces) {
      if (pendingGrams <= 0) return
      quantity = pendingGrams
      compositeQuantityMode = 'pieces'
    } else {
      const gramsEq =
        massInputMode === 'portions'
        && servingTarget.labelPortionGrams
        && servingTarget.labelPortionGrams > 0
          ? pendingPortions * servingTarget.labelPortionGrams
          : pendingGrams
      if (gramsEq <= 0) return
      quantity = gramsEq / 100
      compositeQuantityMode = servingTarget.kind === 'composite' ? 'grams' : undefined
    }

    setItems(prev => {
      const existingIdx = prev.findIndex(i =>
        servingTarget.sourceType === 'user_product'
          ? i.productId === servingTarget.sourceId
          : i.catalogItemId === servingTarget.sourceId,
      )
      if (existingIdx >= 0) {
        return prev.map((it, idx) => (idx === existingIdx ? { ...it, quantity, compositeQuantityMode } : it))
      }
      return [
        ...prev,
        {
          productId: servingTarget.sourceType === 'user_product' ? servingTarget.sourceId : undefined,
          catalogItemId: servingTarget.sourceType === 'catalog_item' ? servingTarget.sourceId : undefined,
          foodSource: servingTarget,
          snapshotName: servingTarget.name,
          snapshotCalories: Math.round(servingTarget.caloriesPer100g ?? servingTarget.calories),
          snapshotProteinG: servingTarget.proteinG,
          snapshotCarbsG: servingTarget.carbsG,
          snapshotFatG: servingTarget.fatG,
          snapshotServingAmount: servingTarget.defaultServingAmount,
          snapshotServingUnit: servingTarget.defaultServingUnit,
          quantity,
          compositeQuantityMode,
        },
      ]
    })
    setSheetView('browse')
  }

  // ─── Cart ─────────────────────────────────────────────────────────────────

  function updateItemGrams(idx: number, value: number) {
    const item = items[idx]
    if (value <= 0) {
      setItems(prev => prev.filter((_, i) => i !== idx))
      return
    }
    if (item.compositeQuantityMode === 'pieces') {
      // value is piece count directly
      setItems(prev =>
        prev.map((it, i) => (i === idx ? { ...it, quantity: value } : it)),
      )
    } else {
      const servingAmount = getItemServingAmount()
      setItems(prev =>
        prev.map((it, i) => (i === idx ? { ...it, quantity: value / servingAmount } : it)),
      )
    }
  }

  // ─── Templates ────────────────────────────────────────────────────────────

  async function handleLogTemplate(template: MealTemplate) {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const apiItems = template.items
        .filter(i => i.productId || i.catalogItemId)
        .map(i => ({
          ...(i.productId ? { product_id: i.productId } : { catalog_item_id: i.catalogItemId! }),
          quantity: i.quantity,
        }))
      if (apiItems.length === 0) throw new Error('Template has no usable items')
      const result = await createMealWithItems(
        logDate,
        loggedAt,
        apiItems,
        template.defaultMealType ?? mealType,
        null,
        template.id,
      )
      invalidateDailyLog(logDate)
      invalidateProducts()
      invalidateTemplates()
      onAdded?.(result)
      onClose()
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to log template')
    } finally {
      setSubmitting(false)
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

  // ─── Submit ───────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (items.length === 0 || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      if (mode === 'add') {
        const apiItems = items.map(item => ({
          ...(item.productId
            ? { product_id: item.productId }
            : { catalog_item_id: item.catalogItemId! }),
          quantity: item.quantity,
          ...(item.compositeQuantityMode && { composite_quantity_mode: item.compositeQuantityMode }),
        }))
        const result = await createMealWithItems(logDate, loggedAt, apiItems, mealType)
        invalidateDailyLog(logDate)
        invalidateProducts()
        onAdded?.(result)
      } else if (mode === 'edit' && meal) {
        const apiItems = items.map(item => {
          if (item.productId) return {
            product_id: item.productId,
            quantity: item.quantity,
            ...(item.compositeQuantityMode && { composite_quantity_mode: item.compositeQuantityMode }),
          }
          if (item.catalogItemId) return {
            catalog_item_id: item.catalogItemId,
            quantity: item.quantity,
            ...(item.compositeQuantityMode && { composite_quantity_mode: item.compositeQuantityMode }),
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
        onSaved?.(meal, result)
      }
      onClose()
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to save meal')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Computed values ──────────────────────────────────────────────────────

  const browseTranslate = sheetView === 'browse' ? 'translateX(0)' : 'translateX(-100%)'
  const detailTranslate = sheetView !== 'browse' ? 'translateX(0)' : 'translateX(100%)'

  const densityPer100 = servingTarget
    ? (servingTarget.caloriesPer100g ?? servingTarget.calories)
    : 0

  const servingLiveKcal = (() => {
    if (!servingTarget) return 0
    if (pendingMode === 'pieces' && isCompositeWithPieces) {
      const gramsPerPiece = servingTarget.totalMassG! / servingTarget.pieceCount!
      return Math.round(pendingGrams * (densityPer100 / 100) * gramsPerPiece)
    }
    const gramsEq =
      massInputMode === 'portions'
      && servingTarget.labelPortionGrams
      && servingTarget.labelPortionGrams > 0
        ? pendingPortions * servingTarget.labelPortionGrams
        : pendingGrams
    return Math.round(gramsEq * (densityPer100 / 100))
  })()

  const isEditingExisting = servingTarget
    ? items.some(i =>
        servingTarget.sourceType === 'user_product'
          ? i.productId === servingTarget.sourceId
          : i.catalogItemId === servingTarget.sourceId,
      )
    : false

  // ─── Footer ───────────────────────────────────────────────────────────────

  const footer =
    sheetView === 'browse' ? (
      <>
        {submitError && <p className="pb-2 text-xs text-[var(--app-danger)]">{submitError}</p>}
        {mode === 'edit' ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-none px-5 py-2.5 text-sm font-medium text-[var(--app-text-muted)] rounded-full border border-[var(--app-border)] transition-colors hover:text-[var(--app-text-primary)] hover:border-[var(--app-text-subtle)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || items.length === 0}
              className="app-button-primary flex-1 py-3 !rounded-full"
            >
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        ) : (
          <>
            {items.length === 0 && (
              <p className="pb-2 text-xs text-center text-[var(--app-text-subtle)]">
                Tap a food to add it to {mealType}
              </p>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={items.length === 0 || submitting}
              className="app-button-primary w-full py-3 !rounded-full"
            >
              {submitting
                ? 'Adding…'
                : items.length > 0
                  ? `Add to ${mealType} · ${items.length} item${items.length !== 1 ? 's' : ''} · ${totalKcal} kcal`
                  : `Add to ${mealType}`}
            </button>
          </>
        )}
      </>
    ) : sheetView === 'serving' ? (
      <button
        type="button"
        onClick={confirmServing}
        disabled={
          pendingMode === 'pieces' && isCompositeWithPieces
            ? pendingGrams <= 0
            : massInputMode === 'portions'
              && servingTarget?.labelPortionGrams
              && servingTarget.labelPortionGrams > 0
              ? pendingPortions <= 0
              : pendingGrams <= 0
        }
        className="app-button-primary w-full py-3 !rounded-full"
      >
        {isEditingExisting ? 'Update' : `Add to ${mealType}`}
      </button>
    ) : null // 'create' view — ProductForm has its own buttons

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <BottomSheet
      onClose={onClose}
      title={mode === 'add' ? `Add to ${mealType}` : 'Edit meal'}
      className="h-[85vh] sm:h-[600px]"
      footer={footer}
    >
      {/* Header band — always visible above the sliding views */}
      <div className="flex-none bg-white">
        {mode === 'edit' && (
          <div className="px-4 pt-3 pb-2">
            <input
              type="text"
              value={mealName}
              onChange={(e) => setMealName(e.target.value)}
              placeholder="Meal name (optional)"
              className="app-input px-3 py-2 text-sm"
            />
          </div>
        )}
        <div className="px-4 pt-1.5 pb-0">
          <p className="text-[10px] font-semibold tracking-widest uppercase text-[var(--app-text-subtle)]">
            Meal type
          </p>
        </div>
        <MealTypeSelector value={mealType} onChange={setMealType} />
      </div>

      {/* Sliding views container */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* ── Browse view ──────────────────────────────────────────────────── */}
        <div
          className="absolute inset-0 flex flex-col transition-transform duration-[250ms] ease-out"
          style={{ transform: browseTranslate }}
        >
          {/* Search bar */}
          <div className="flex-none px-4 py-2 bg-white">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search foods…"
              className="app-input w-full px-4 py-1.5 text-sm !rounded-full"
            />
          </div>

          {/* Cart bar */}
          {items.length > 0 && (
            <div className="flex-none border-b border-[var(--app-border)]">
              <button
                type="button"
                onClick={() => setCartOpen((o) => !o)}
                className="flex w-full items-center justify-between px-4 py-2.5 transition-colors"
                style={{
                  background: mealTheme ? mealTheme.bg : 'var(--app-brand-soft)',
                  color: mealTheme ? mealTheme.text : 'var(--app-brand)',
                }}
                aria-expanded={cartOpen}
                aria-label={`${items.length} item${items.length !== 1 ? 's' : ''} selected, ${totalKcal} kcal — ${cartOpen ? 'collapse' : 'expand'} cart`}
              >
                <span className="text-sm font-medium">
                  {items.length} item{items.length !== 1 ? 's' : ''} ·{' '}
                  <span className="font-semibold">{totalKcal} kcal</span>
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
              {cartOpen && (
                <div className="max-h-40 overflow-y-auto">
                  {items.map((item, idx) => {
                    const isPieceMode = item.compositeQuantityMode === 'pieces'
                    const displayValue = isPieceMode
                      ? item.quantity
                      : Math.round(item.quantity * getItemServingAmount())
                    const kcal = getItemKcal(item)
                    const sourceType = getItemSourceType(item)
                    return (
                      <div
                        key={getItemKey(item)}
                        className="flex items-center gap-2 px-4 border-b border-[var(--app-border-muted)] last:border-0 bg-white/60"
                      >
                        <button
                          type="button"
                          onClick={() => updateItemGrams(idx, 0)}
                          className="flex-none h-10 w-10 flex items-center justify-center text-[var(--app-text-subtle)] hover:text-[var(--app-danger)] transition-colors text-sm"
                          aria-label={`Remove ${getItemLabel(item)}`}
                        >
                          ✕
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {sourceType && <FoodSourceBadge sourceType={sourceType} />}
                            <p className="text-sm truncate text-[var(--app-text-primary)]">
                              {getItemLabel(item)}
                            </p>
                          </div>
                          <p className="text-xs text-[var(--app-text-muted)]">
                            {kcal} kcal
                            {isPieceMode && item.foodSource?.pieceLabel && (
                              <span className="ml-1">· {item.quantity} {item.foodSource.pieceLabel}</span>
                            )}
                          </p>
                        </div>
                        <GramInput
                          grams={displayValue}
                          onChange={(g) => updateItemGrams(idx, g)}
                          showSteppers={false}
                          {...(isPieceMode
                            ? {
                                unitSuffix: item.foodSource?.pieceLabel ?? 'pc',
                                quantityAriaLabel: 'Pieces',
                              }
                            : {})}
                        />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <SegmentedTabs
            value={tab}
            options={[
              { value: 'recent', label: 'Recent' },
              { value: 'saved', label: 'Saved' },
            ]}
            onChange={(t) => setTab(t)}
            className="!bg-white !shadow-none !pt-1.5 !pb-3 !border-b !border-[var(--app-border-muted)]"
          />

          {/* Search pending indicator — only for food source search */}
          {isSearching && tab === 'recent' && searchResults.isPending && (
            <div className="px-4 py-3 text-sm text-[var(--app-text-muted)]">Searching…</div>
          )}

          {/* Scrollable food/template list */}
          <div className="flex-1 overflow-y-auto">
            {tab === 'saved' ? (
              /* Saved templates */
              visibleTemplates.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  {isSearching ? (
                    <p className="text-sm text-[var(--app-text-muted)]">No saved meals match &ldquo;{deferredSearchQuery.trim()}&rdquo;</p>
                  ) : (
                    <>
                      <p className="text-sm text-[var(--app-text-muted)]">No saved meals yet.</p>
                      <p className="mt-1 text-xs text-[var(--app-text-subtle)]">
                        Save a meal from the meal card to reuse it here.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                visibleTemplates.map((template) => (
                  <TemplateRow
                    key={template.id}
                    template={template}
                    loading={submitting}
                    onLog={() => handleLogTemplate(template)}
                    onDelete={() => handleDeleteTemplate(template.id)}
                  />
                ))
              )
            ) : (
              /* Food sources (recent or search results) */
              <>
                {isSearching && !searchResults.isPending && (searchResults.data?.length ?? 0) === 0 ? (
                  <div className="flex flex-col items-center py-8 gap-3">
                    <p className="text-sm text-[var(--app-text-muted)]">No foods found</p>
                    <button
                      type="button"
                      onClick={() => setSheetView('create')}
                      className="app-button-secondary text-sm px-4 py-2"
                    >
                      + Create &ldquo;{deferredSearchQuery.trim()}&rdquo;
                    </button>
                  </div>
                ) : (
                  <>
                    {activeFoodSources.map((fs) => (
                      <FoodRow
                        key={`${fs.sourceType}:${fs.sourceId}`}
                        name={fs.name}
                        subtitle={`${Math.round(fs.caloriesPer100g)} kcal / 100g${fs.labelPortionGrams ? ` · label portion ${fs.labelPortionGrams}g` : ''}`}
                        leading={
                          fs.kind === 'composite' ? (
                            <svg className="w-4 h-4 text-[var(--app-brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 6h14M5 10h14M5 14h10" />
                            </svg>
                          ) : (
                            <FoodSourceBadge sourceType={fs.sourceType} />
                          )
                        }
                        isChecked={isItemInCart(fs)}
                        onTap={() => handleFoodTap(fs)}
                        macroChips={
                          fs.proteinG != null || fs.carbsG != null || fs.fatG != null
                            ? { p: fs.proteinG, c: fs.carbsG, f: fs.fatG }
                            : undefined
                        }
                      />
                    ))}
                    {/* Create food entry — bottom of recent list */}
                    {!isSearching && (
                      <button
                        type="button"
                        onClick={() => setSheetView('create')}
                        className="flex w-full items-center gap-3 px-4 py-3 text-sm text-[var(--app-text-muted)] hover:text-[var(--app-brand)] hover:bg-[var(--app-hover-overlay)] transition-colors border-t border-[var(--app-border-muted)]"
                      >
                        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-dashed border-[var(--app-border)] text-lg leading-none">
                          +
                        </span>
                        <span>Create new food</span>
                      </button>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Detail view (serving step or create food form) ─────────────── */}
        <div
          className="absolute inset-0 flex flex-col transition-transform duration-[250ms] ease-out"
          style={{ transform: detailTranslate }}
        >
          {sheetView === 'serving' && servingTarget && (
            <ServingStep
              foodSource={servingTarget}
              grams={pendingGrams}
              portions={pendingPortions}
              liveKcal={servingLiveKcal}
              onGramsChange={setPendingGrams}
              onPortionsChange={setPendingPortions}
              massInputMode={massInputMode}
              onMassInputModeChange={(mode) => {
                setMassInputMode(mode)
                const lg = servingTarget.labelPortionGrams
                if (mode === 'portions' && lg && lg > 0) {
                  setPendingPortions(Math.max(1, Math.round(pendingGrams / lg)))
                } else if (mode === 'grams' && lg && lg > 0) {
                  setPendingGrams(Math.round(pendingPortions * lg))
                }
              }}
              onBack={() => setSheetView('browse')}
              isUpdate={isEditingExisting}
              compositeMode={pendingMode}
              onModeChange={setPendingMode}
              showModeToggle={isCompositeWithPieces}
            />
          )}
          {sheetView === 'create' && (
            <div className="flex-1 overflow-y-auto">
              <ProductForm
                onSave={() => {
                  invalidateProducts()
                  setSheetView('browse')
                }}
                onSaveAndAdd={(product) => {
                  const cal100 = product.caloriesPer100g ?? product.calories
                  const fs: FoodSource = {
                    sourceType: 'user_product',
                    sourceId: product.id,
                    name: product.name,
                    calories: product.calories,
                    caloriesPer100g: cal100,
                    proteinG: product.proteinG,
                    carbsG: product.carbsG,
                    fatG: product.fatG,
                    defaultServingAmount: product.defaultServingAmount,
                    defaultServingUnit: product.defaultServingUnit,
                    labelPortionGrams: product.labelPortionGrams,
                    useCount: 0,
                    lastUsedAt: null,
                    kind: 'simple' as const,
                    pieceCount: null,
                    pieceLabel: null,
                    totalMassG: null,
                  }
                  invalidateProducts()
                  setMassInputMode('grams')
                  setPendingPortions(1)
                  setPendingGrams(product.labelPortionGrams ?? 100)
                  setPendingMode('grams')
                  setServingTarget(fs)
                  setSheetView('serving')
                }}
                onCancel={() => setSheetView('browse')}
              />
            </div>
          )}
        </div>
      </div>
    </BottomSheet>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ServingStep({
  foodSource,
  grams,
  portions,
  liveKcal,
  onGramsChange,
  onPortionsChange,
  massInputMode,
  onMassInputModeChange,
  onBack,
  isUpdate,
  compositeMode,
  onModeChange,
  showModeToggle,
}: {
  foodSource: FoodSource
  grams: number
  portions: number
  liveKcal: number
  onGramsChange: (g: number) => void
  onPortionsChange: (n: number) => void
  massInputMode: 'grams' | 'portions'
  onMassInputModeChange: (mode: 'grams' | 'portions') => void
  onBack: () => void
  isUpdate: boolean
  compositeMode: 'grams' | 'pieces'
  onModeChange: (mode: 'grams' | 'pieces') => void
  showModeToggle: boolean
}) {
  void isUpdate

  const isPieceMode = compositeMode === 'pieces' && showModeToggle
  const gramsPerPiece = foodSource.totalMassG && foodSource.pieceCount && foodSource.pieceCount > 0
    ? foodSource.totalMassG / foodSource.pieceCount
    : null

  const labelPortionG = foodSource.labelPortionGrams
  const showLabelPortionTabs = Boolean(labelPortionG && labelPortionG > 0 && !showModeToggle)
  const portionStepperSuffix =
    foodSource.defaultServingUnit?.trim() && foodSource.defaultServingUnit !== 'g'
      ? foodSource.defaultServingUnit
      : 'portion'

  function handleCompositeModeSwitch(mode: 'grams' | 'pieces') {
    if (mode === compositeMode) return
    if (mode === 'pieces' && gramsPerPiece) {
      const pieces = Math.max(1, Math.round(grams / gramsPerPiece))
      onGramsChange(pieces)
    } else if (mode === 'grams' && gramsPerPiece) {
      const g = Math.round(grams * gramsPerPiece)
      onGramsChange(g)
    }
    onModeChange(mode)
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-none flex items-center gap-3 px-4 py-3 border-b border-[var(--app-border-muted)]">
        <button
          type="button"
          onClick={onBack}
          className="flex-none h-9 w-9 flex items-center justify-center rounded-full hover:bg-[var(--app-hover-overlay)] transition-colors text-[var(--app-text-muted)]"
          aria-label="Back to food list"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <FoodSourceBadge sourceType={foodSource.sourceType} />
          <p className="text-sm font-semibold text-[var(--app-text-primary)] truncate">{foodSource.name}</p>
        </div>
      </div>

      {showModeToggle && (
        <div className="flex-none px-6 pt-3">
          <SegmentedTabs
            value={compositeMode}
            options={[
              { value: 'grams' as const, label: 'Grams' },
              { value: 'pieces' as const, label: 'Pieces' },
            ]}
            onChange={handleCompositeModeSwitch}
            className="!bg-transparent !px-0 !py-0 !shadow-none"
          />
        </div>
      )}

      {showLabelPortionTabs && (
        <div className="flex-none px-6 pt-3">
          <SegmentedTabs
            value={massInputMode}
            options={[
              { value: 'grams' as const, label: 'Grams' },
              { value: 'portions' as const, label: 'Portions' },
            ]}
            onChange={onMassInputModeChange}
            className="!bg-transparent !px-0 !py-0 !shadow-none"
          />
        </div>
      )}

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-8 py-6">
        <div className="text-center">
          <p className="text-6xl font-bold tabular-nums text-[var(--app-text-primary)] leading-none">
            {liveKcal}
          </p>
          <p className="mt-2 text-sm text-[var(--app-text-muted)]">kcal</p>
        </div>

        <div className="flex flex-col items-center gap-2">
          {isPieceMode ? (
            <GramInput
              grams={grams}
              onChange={onGramsChange}
              showSteppers
              step={1}
              unitSuffix={foodSource.pieceLabel ?? 'pc'}
              quantityAriaLabel="Pieces"
            />
          ) : showLabelPortionTabs && massInputMode === 'portions' ? (
            <GramInput
              grams={portions}
              onChange={onPortionsChange}
              showSteppers
              step={1}
              unitSuffix={portionStepperSuffix}
              quantityAriaLabel="Portions"
            />
          ) : (
            <GramInput grams={grams} onChange={onGramsChange} showSteppers step={10} />
          )}
          {isPieceMode && gramsPerPiece && foodSource.pieceLabel ? (
            <p className="text-xs text-[var(--app-text-subtle)]">
              1 {foodSource.pieceLabel} = {Math.round(gramsPerPiece)}g
            </p>
          ) : showLabelPortionTabs && massInputMode === 'portions' && labelPortionG ? (
            <p className="text-xs text-[var(--app-text-subtle)]">
              1 portion = {Math.round(labelPortionG)}g (from label)
            </p>
          ) : (
            foodSource.defaultServingUnit &&
            foodSource.defaultServingUnit !== 'g' &&
            foodSource.defaultServingAmount != null && (
              <p className="text-xs text-[var(--app-text-subtle)]">
                1 {foodSource.defaultServingUnit} = {foodSource.defaultServingAmount}g
              </p>
            )
          )}
        </div>
      </div>
    </div>
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
          type="button"
          onClick={onDelete}
          className="text-[var(--app-text-subtle)] hover:text-[var(--app-danger)] transition-colors text-xs px-1.5 py-1"
          aria-label="Delete template"
        >
          ✕
        </button>
        <button
          type="button"
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
