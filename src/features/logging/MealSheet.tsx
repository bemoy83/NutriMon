import { useState, useDeferredValue, useEffect, useRef } from 'react'
import { useInvalidateDailyLog } from './useDailyLog'
import { createMealWithItems, deleteMealTemplate } from './api'
import type { FoodSource, MealTemplate } from '@/types/domain'
import type { MealMutationResult } from '@/types/database'
import { useFoodSourceSearch, useRecentFoodSources } from './useFoodSources'
import { useInvalidateMealTemplates, useInvalidateProductQueries } from './queryInvalidation'
import { useMealTemplates } from './useMealTemplates'
import BottomSheet from '@/components/ui/BottomSheet'
import FoodRow from '@/components/ui/FoodRow'
import FoodSourceBadge from '@/components/ui/FoodSourceBadge'
import GramInput from '@/components/ui/GramInput'
import SegmentedTabs from '@/components/ui/SegmentedTabs'
import ProductForm from './ProductForm'
import ServingStep from './ServingStep'
import {
  getItemKey,
  getItemKcal,
  getItemLabel,
  getItemServingAmount,
  getItemSourceType,
} from './itemHelpers'
import type { Item } from './types'
import { MEAL_TYPES, getDefaultMealType, getMealTypeTheme } from '@/lib/mealType'
import type { MealType } from '@/lib/mealType'

interface MealSheetProps {
  logDate: string
  loggedAt: string
  onClose: () => void
  onAdded?: (result: MealMutationResult) => void
  defaultMealType?: MealType
  onItemsSelected?: (items: Item[]) => void
}

type SheetView = 'browse' | 'serving' | 'create'

export default function MealSheet({
  logDate,
  loggedAt,
  onClose,
  onAdded,
  defaultMealType,
  onItemsSelected,
}: MealSheetProps) {
  const [sheetView, setSheetView] = useState<SheetView>('browse')
  const [servingTarget, setServingTarget] = useState<FoodSource | null>(null)
  const [pendingGrams, setPendingGrams] = useState(100)
  const [pendingPortions, setPendingPortions] = useState(1)
  const [massInputMode, setMassInputMode] = useState<'grams' | 'portions'>('grams')
  const [pendingMode, setPendingMode] = useState<'grams' | 'pieces'>('grams')
  const [items, setItems] = useState<Item[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [tab, setTab] = useState<'recent' | 'saved'>('recent')
  const [mealType, setMealType] = useState<MealType>(defaultMealType ?? getDefaultMealType(loggedAt))
  const [mealMenuOpen, setMealMenuOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const mealMenuRef = useRef<HTMLDivElement | null>(null)

  const invalidateDailyLog = useInvalidateDailyLog()
  const invalidateProducts = useInvalidateProductQueries()
  const invalidateTemplates = useInvalidateMealTemplates()

  const deferredSearchQuery = useDeferredValue(searchQuery)
  const recentQuery = useRecentFoodSources()
  const searchResults = useFoodSourceSearch(deferredSearchQuery)
  const templatesQuery = useMealTemplates()

  const mealTheme = getMealTypeTheme(mealType)
  const totalKcal = items.reduce((sum, i) => sum + getItemKcal(i), 0)

  useEffect(() => {
    if (items.length === 0) setCartOpen(false)
  }, [items.length])

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

  useEffect(() => {
    if (!mealMenuOpen) return

    function handlePointerDown(e: PointerEvent) {
      if (!mealMenuRef.current?.contains(e.target as Node)) {
        setMealMenuOpen(false)
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setMealMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [mealMenuOpen])

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
    return items.some((i) =>
      fs.sourceType === 'user_product' ? i.productId === fs.sourceId : i.catalogItemId === fs.sourceId,
    )
  }

  function handleFoodTap(foodSource: FoodSource) {
    const existing = items.find((i) =>
      foodSource.sourceType === 'user_product'
        ? i.productId === foodSource.sourceId
        : i.catalogItemId === foodSource.sourceId,
    )

    setMassInputMode('grams')

    if (existing?.compositeQuantityMode === 'pieces') {
      setPendingMode('pieces')
      setPendingGrams(existing.quantity)
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

  const isCompositeWithPieces = servingTarget?.kind === 'composite'
    && (servingTarget.pieceCount ?? 0) > 0
    && (servingTarget.totalMassG ?? 0) > 0

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

    setItems((prev) => {
      const existingIdx = prev.findIndex((i) =>
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

  function updateItemGrams(idx: number, value: number) {
    const item = items[idx]
    if (value <= 0) {
      setItems((prev) => prev.filter((_, i) => i !== idx))
      return
    }
    if (item.compositeQuantityMode === 'pieces') {
      setItems((prev) =>
        prev.map((it, i) => (i === idx ? { ...it, quantity: value } : it)),
      )
      return
    }
    const servingAmount = getItemServingAmount()
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, quantity: value / servingAmount } : it)),
    )
  }

  async function handleLogTemplate(template: MealTemplate) {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const apiItems = template.items
        .filter((i) => i.productId || i.catalogItemId)
        .map((i) => ({
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

  async function handleSubmit() {
    if (items.length === 0 || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      if (onItemsSelected) {
        onItemsSelected(items)
        onClose()
        return
      }
      const apiItems = items.map((item) => ({
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
      onClose()
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to save meal')
    } finally {
      setSubmitting(false)
    }
  }

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
    ? items.some((i) =>
        servingTarget.sourceType === 'user_product'
          ? i.productId === servingTarget.sourceId
          : i.catalogItemId === servingTarget.sourceId,
      )
    : false
  const browseSubmitDisabled = items.length === 0 || submitting
  const servingConfirmDisabled =
    pendingMode === 'pieces' && isCompositeWithPieces
      ? pendingGrams <= 0
      : massInputMode === 'portions'
        && servingTarget?.labelPortionGrams
        && servingTarget.labelPortionGrams > 0
        ? pendingPortions <= 0
        : pendingGrams <= 0
  const mealCtaStyle = mealTheme
    ? {
        background: mealTheme.accent,
        boxShadow: `0 10px 24px ${mealTheme.buttonShadow}`,
      }
    : undefined
  const mealCtaDisabledStyle = mealTheme
    ? {
        background: mealTheme.bg,
        color: mealTheme.text,
        boxShadow: 'none',
      }
    : undefined

  const mealTitleControl = (
    <div ref={mealMenuRef} className="relative">
      <button
        type="button"
        onClick={() => setMealMenuOpen((open) => !open)}
        className="group inline-flex items-center gap-1.5 rounded-md py-1 pr-1 text-base font-semibold text-[var(--app-text-primary)] transition-[color,box-shadow] duration-[var(--app-transition-fast)] hover:text-[var(--app-text-secondary)] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--app-brand-ring),var(--app-input-shadow-focus)]"
        aria-haspopup="menu"
        aria-expanded={mealMenuOpen}
        aria-label={`Change meal type, currently ${mealType}`}
      >
        <span>
          Add to{' '}
          <span style={{ color: mealTheme?.text ?? 'var(--app-brand)' }}>
            {mealType}
          </span>
        </span>
        <svg
          className={`h-4 w-4 transition-transform duration-[var(--app-transition-fast)] ${mealMenuOpen ? 'rotate-180' : ''}`}
          style={{ color: mealTheme?.text ?? 'var(--app-brand)' }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {mealMenuOpen && (
        <div
          role="menu"
          className="absolute left-0 top-full z-30 mt-2 w-44 rounded-2xl border border-[var(--app-border-muted)] bg-white p-1.5 shadow-[0_12px_32px_rgb(15_23_42/0.16)]"
        >
          {MEAL_TYPES.map((type) => {
            const selected = mealType === type
            const theme = getMealTypeTheme(type)

            return (
              <button
                key={type}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => {
                  setMealType(type)
                  setMealMenuOpen(false)
                }}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-[var(--app-input-bg)] focus-visible:bg-[var(--app-input-bg)] focus-visible:outline-none"
                style={{
                  color: selected
                    ? (theme?.text ?? 'var(--app-brand)')
                    : 'var(--app-text-secondary)',
                }}
              >
                <span>{type}</span>
                {selected && (
                  <svg className="h-4 w-4 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )

  const cartSummary =
    items.length > 0 ? (
      <div className="mb-3 overflow-hidden rounded-2xl border border-[var(--app-border-muted)] bg-white">
        <button
          type="button"
          onClick={() => setCartOpen((o) => !o)}
          className="flex w-full items-center justify-between px-3.5 py-2.5 text-left transition-colors"
          style={{
            background: mealTheme ? mealTheme.bg : 'var(--app-brand-soft)',
            color: mealTheme ? mealTheme.text : 'var(--app-brand)',
          }}
          aria-expanded={cartOpen}
          aria-label={`${items.length} item${items.length !== 1 ? 's' : ''} selected, ${totalKcal} kcal — ${cartOpen ? 'collapse' : 'expand'} cart`}
        >
          <span className="text-sm font-medium">
            Pending · {items.length} item{items.length !== 1 ? 's' : ''} ·{' '}
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
          <div className="max-h-44 overflow-y-auto">
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
                  className="flex items-center gap-2 border-b border-[var(--app-border-muted)] px-3 py-2 last:border-0"
                >
                  <button
                    type="button"
                    onClick={() => updateItemGrams(idx, 0)}
                    className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm text-[var(--app-text-subtle)] transition-colors hover:bg-[var(--app-danger-soft)] hover:text-[var(--app-danger)]"
                    aria-label={`Remove ${getItemLabel(item)}`}
                  >
                    ✕
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {sourceType && <FoodSourceBadge sourceType={sourceType} />}
                      <p className="truncate text-sm text-[var(--app-text-primary)]">
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
    ) : null

  const footer =
    sheetView === 'browse' ? (
      <>
        {submitError && <p className="pb-2 text-xs text-[var(--app-danger)]">{submitError}</p>}
        {items.length === 0 && (
          <p className="pb-2 text-xs text-center text-[var(--app-text-subtle)]">
            Tap a food to add it to {mealType}
          </p>
        )}
        {cartSummary}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={browseSubmitDisabled}
          className="app-button-primary w-full py-3 !rounded-full"
          style={browseSubmitDisabled ? mealCtaDisabledStyle : mealCtaStyle}
        >
          {submitting
            ? 'Adding…'
            : items.length > 0
              ? `Add to ${mealType} · ${items.length} item${items.length !== 1 ? 's' : ''} · ${totalKcal} kcal`
              : `Add to ${mealType}`}
        </button>
      </>
    ) : sheetView === 'serving' ? (
      <button
        type="button"
        onClick={confirmServing}
        disabled={servingConfirmDisabled}
        className="app-button-primary w-full py-3 !rounded-full"
        style={servingConfirmDisabled ? mealCtaDisabledStyle : mealCtaStyle}
      >
        {isEditingExisting ? 'Update' : `Add to ${mealType}`}
      </button>
    ) : null

  return (
    <BottomSheet
      onClose={onClose}
      title={`Add to ${mealType}`}
      titleContent={mealTitleControl}
      className="h-[85vh] sm:h-[600px]"
      footer={footer}
    >
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div
          className="absolute inset-0 flex flex-col transition-transform duration-[250ms] ease-out"
          style={{ transform: browseTranslate }}
        >
          <div className="flex-none px-4 py-2 bg-white">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search foods…"
              className="app-input w-full px-4 py-1.5 text-sm !rounded-full"
            />
          </div>

          <SegmentedTabs
            value={tab}
            options={[
              { value: 'recent', label: 'Recent' },
              { value: 'saved', label: 'Saved' },
            ]}
            onChange={(t) => setTab(t)}
            className="!bg-white !shadow-none !pt-1.5 !pb-3 !border-b !border-[var(--app-border-muted)]"
          />

          {isSearching && tab === 'recent' && searchResults.isPending && (
            <div className="px-4 py-3 text-sm text-[var(--app-text-muted)]">Searching…</div>
          )}

          <div className="flex-1 overflow-y-auto">
            {tab === 'saved' ? (
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

        <div
          className="absolute inset-0 flex flex-col transition-transform duration-[250ms] ease-out"
          style={{ transform: detailTranslate }}
        >
          {sheetView === 'serving' && servingTarget && (
            <ServingStep
              target={{
                name: servingTarget.name,
                sourceType: servingTarget.sourceType,
                defaultServingAmount: servingTarget.defaultServingAmount,
                defaultServingUnit: servingTarget.defaultServingUnit,
                labelPortionGrams: servingTarget.labelPortionGrams,
                pieceCount: servingTarget.pieceCount,
                pieceLabel: servingTarget.pieceLabel,
                totalMassG: servingTarget.totalMassG,
              }}
              grams={pendingGrams}
              portions={pendingPortions}
              liveKcal={servingLiveKcal}
              onGramsChange={setPendingGrams}
              onPortionsChange={setPendingPortions}
              massInputMode={massInputMode}
              onMassInputModeChange={(mode) => {
                setMassInputMode(mode)
                const labelGrams = servingTarget.labelPortionGrams
                if (mode === 'portions' && labelGrams && labelGrams > 0) {
                  setPendingPortions(Math.max(1, Math.round(pendingGrams / labelGrams)))
                } else if (mode === 'grams' && labelGrams && labelGrams > 0) {
                  setPendingGrams(Math.round(pendingPortions * labelGrams))
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
                  const foodSource: FoodSource = {
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
                    kind: 'simple',
                    pieceCount: null,
                    pieceLabel: null,
                    totalMassG: null,
                  }
                  invalidateProducts()
                  setMassInputMode('grams')
                  setPendingPortions(1)
                  setPendingGrams(product.labelPortionGrams ?? 100)
                  setPendingMode('grams')
                  setServingTarget(foodSource)
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
