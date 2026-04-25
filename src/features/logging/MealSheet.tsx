import { useState, useDeferredValue, useEffect, useMemo, useRef } from 'react'
import { useInvalidateDailyLog } from './useDailyLog'
import { createMealWithItems, deleteMealTemplate } from './api'
import type { FoodSource, MealTemplate } from '@/types/domain'
import type { MealMutationResult } from '@/types/database'
import { useFoodSourceSearch, useRecentFoodSources } from './useFoodSources'
import { useInvalidateMealTemplates, useInvalidateProductQueries } from './queryInvalidation'
import { useMealTemplates } from './useMealTemplates'
import BottomSheet from '@/components/ui/BottomSheet'
import {
  applyMassInputModeForLabel,
  buildConfirmPayloadFromFood,
  computeLiveEstimateFoodSource,
  isCompositeWithPiecesForFood,
  isConfirmDisabledForFood,
} from './servingDraftModel'
import { useFoodSourceServingDraft } from './useServingDraft'
import {
  getItemKcal,
  getItemServingAmount,
} from './itemHelpers'
import type { Item } from './types'
import { getDefaultMealType, getMealTypeTheme } from '@/lib/mealType'
import type { MealType } from '@/lib/mealType'
import MealTypeTitleMenu from './meal-sheet/MealTypeTitleMenu'
import MealSheetBrowseView from './meal-sheet/MealSheetBrowseView'
import MealSheetDetailPane from './meal-sheet/MealSheetDetailPane'
import { MealSheetBrowseFooter, MealSheetServingFooter } from './meal-sheet/MealSheetFooters'

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
  const {
    pendingGrams,
    setPendingGrams,
    pendingPortions,
    setPendingPortions,
    massInputMode,
    setMassInputMode,
    pendingMode,
    setPendingMode,
    reinitialize: reinitializeServingDraft,
  } = useFoodSourceServingDraft()
  const [items, setItems] = useState<Item[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [tab, setTab] = useState<'recent' | 'saved' | 'pending'>('recent')
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

  function isItemPending(fs: FoodSource): boolean {
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

    reinitializeServingDraft(foodSource, existing)
    setServingTarget(foodSource)
    setSheetView('serving')
  }

  function confirmServing() {
    if (!servingTarget) return

    const payload = buildConfirmPayloadFromFood(servingTarget, {
      pendingMode,
      massInputMode,
      pendingGrams,
      pendingPortions,
    })
    if (!payload) return
    const { quantity, compositeQuantityMode } = payload

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
          snapshotLabelPortionGrams: servingTarget.labelPortionGrams ?? null,
          quantity,
          compositeQuantityMode,
        },
      ]
    })
    setSheetView('browse')
  }

  function handleServingRemove() {
    if (!servingTarget) return
    setItems((prev) => prev.filter((i) =>
      servingTarget.sourceType === 'user_product'
        ? i.productId !== servingTarget.sourceId
        : i.catalogItemId !== servingTarget.sourceId,
    ))
    setSheetView('browse')
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

  const servingEstimate = useMemo(
    () =>
      servingTarget
        ? computeLiveEstimateFoodSource(servingTarget, {
            pendingMode,
            massInputMode,
            pendingGrams,
            pendingPortions,
          })
        : { kcal: 0, proteinG: null, carbsG: null, fatG: null },
    [servingTarget, pendingMode, massInputMode, pendingGrams, pendingPortions],
  )

  const isEditingExisting = servingTarget
    ? items.some((i) =>
        servingTarget.sourceType === 'user_product'
          ? i.productId === servingTarget.sourceId
          : i.catalogItemId === servingTarget.sourceId,
      )
    : false
  const browseSubmitDisabled = items.length === 0 || submitting
  const isCompositeWithPieces = Boolean(servingTarget && isCompositeWithPiecesForFood(servingTarget))
  const servingConfirmDisabled = servingTarget
    ? isConfirmDisabledForFood(servingTarget, {
        pendingMode,
        massInputMode,
        pendingGrams,
        pendingPortions,
      })
    : true
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

  function getPendingItemServingLabel(item: Item): string {
    if (item.compositeQuantityMode === 'pieces') {
      return `${item.quantity} ${item.foodSource?.pieceLabel ?? 'pc'}`
    }
    return `${Math.round(item.quantity * getItemServingAmount())}g`
  }

  return (
    <BottomSheet
      onClose={onClose}
      title={`Add to ${mealType}`}
      titleContent={(
        <MealTypeTitleMenu
          mealMenuRef={mealMenuRef}
          mealMenuOpen={mealMenuOpen}
          onOpenChange={setMealMenuOpen}
          mealType={mealType}
          onMealTypeChange={setMealType}
          mealTheme={mealTheme}
        />
      )}
      className="h-[85vh] sm:h-[600px]"
    >
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div
          className="absolute inset-0 flex flex-col transition-transform duration-[250ms] ease-out"
          aria-hidden={sheetView !== 'browse'}
          style={{ transform: browseTranslate }}
        >
          <MealSheetBrowseView
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            tab={tab}
            onTabChange={setTab}
            items={items}
            isSearching={isSearching}
            deferredSearchQuery={deferredSearchQuery}
            searchResults={searchResults}
            activeFoodSources={activeFoodSources}
            visibleTemplates={visibleTemplates}
            submitting={submitting}
            isItemPending={isItemPending}
            onFoodTap={handleFoodTap}
            getPendingItemServingLabel={getPendingItemServingLabel}
            onLogTemplate={handleLogTemplate}
            onDeleteTemplate={handleDeleteTemplate}
            onOpenCreateFood={() => setSheetView('create')}
            footer={(
              <MealSheetBrowseFooter
                submitError={submitError}
                itemsCount={items.length}
                mealType={mealType}
                totalKcal={totalKcal}
                submitting={submitting}
                browseSubmitDisabled={browseSubmitDisabled}
                mealCtaStyle={mealCtaStyle}
                mealCtaDisabledStyle={mealCtaDisabledStyle}
                onSubmit={handleSubmit}
              />
            )}
          />
        </div>

        <div
          className="absolute inset-0 flex flex-col transition-transform duration-[250ms] ease-out"
          aria-hidden={sheetView === 'browse'}
          style={{ transform: detailTranslate }}
        >
          <MealSheetDetailPane
            sheetView={sheetView}
            servingTarget={servingTarget}
            pendingGrams={pendingGrams}
            onPendingGramsChange={setPendingGrams}
            pendingPortions={pendingPortions}
            onPendingPortionsChange={setPendingPortions}
            massInputMode={massInputMode}
            onMassInputModeChange={(mode) => {
              setMassInputMode(mode)
              if (!servingTarget) return
              const { pendingGrams: g, pendingPortions: p } = applyMassInputModeForLabel(
                servingTarget.labelPortionGrams,
                mode,
                pendingGrams,
                pendingPortions,
              )
              setPendingGrams(g)
              setPendingPortions(p)
            }}
            pendingMode={pendingMode}
            onPendingModeChange={setPendingMode}
            servingEstimate={servingEstimate}
            isCompositeWithPieces={isCompositeWithPieces}
            isEditingExisting={isEditingExisting}
            onServingBack={() => setSheetView('browse')}
            onServingRemove={handleServingRemove}
            onProductSave={() => {
              invalidateProducts()
              setSheetView('browse')
            }}
            onProductSaveAndAdd={(product) => {
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
              reinitializeServingDraft(foodSource)
              setServingTarget(foodSource)
              setSheetView('serving')
            }}
            onProductCancel={() => setSheetView('browse')}
            servingFooter={(
              <MealSheetServingFooter
                servingConfirmDisabled={servingConfirmDisabled}
                mealCtaStyle={mealCtaStyle}
                mealCtaDisabledStyle={mealCtaDisabledStyle}
                isEditingExisting={isEditingExisting}
                mealType={mealType}
                onConfirm={confirmServing}
              />
            )}
          />
        </div>
      </div>
    </BottomSheet>
  )
}
