import { useState, useDeferredValue, useEffect, useMemo, useRef, useCallback } from 'react'
import { useInvalidateDailyLog } from './useDailyLog'
import { createMealWithItems, deleteMealTemplate } from './api'
import type { FoodSource, MealTemplate, Product } from '@/types/domain'
import type { MealMutationResult } from '@/types/database'
import { useFoodSourceSearch, useRecentFoodSources } from './useFoodSources'
import {
  useInvalidateFoodSourceLists,
  useInvalidateMealTemplates,
  useInvalidateUserFoodLibrary,
} from './queryInvalidation'
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
import { lookupBarcode, type KassalappProduct } from '@/lib/kassalapp'
import BarcodeScannerView from './meal-sheet/BarcodeScannerView'
import type { ProductFormPrefill } from './ProductForm'

interface MealSheetProps {
  logDate: string
  loggedAt: string
  onClose: () => void
  onAdded?: (result: MealMutationResult) => void
  defaultMealType?: MealType
  onItemsSelected?: (items: Item[]) => void
}

type SheetView = 'browse' | 'serving' | 'create' | 'scan'

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
  const [productFormPrefill, setProductFormPrefill] = useState<ProductFormPrefill | undefined>()
  const [scanLoading, setScanLoading] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const mealMenuRef = useRef<HTMLDivElement | null>(null)

  const invalidateDailyLog = useInvalidateDailyLog()
  const invalidateFoodSources = useInvalidateFoodSourceLists()
  const invalidateUserFoodLibrary = useInvalidateUserFoodLibrary()
  const invalidateTemplates = useInvalidateMealTemplates()

  const deferredSearchQuery = useDeferredValue(searchQuery)
  const recentQuery = useRecentFoodSources()
  const searchResults = useFoodSourceSearch(deferredSearchQuery)
  const templatesQuery = useMealTemplates()

  const mealTheme = getMealTypeTheme(mealType)
  const totalKcal = useMemo(() => items.reduce((sum, i) => sum + getItemKcal(i), 0), [items])

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

  const activeFoodSources: FoodSource[] = useMemo(
    () => (tab === 'recent' ? (isSearching ? (searchResults.data ?? []) : (recentQuery.data ?? [])) : []),
    [tab, isSearching, searchResults.data, recentQuery.data],
  )

  const visibleTemplates = useMemo(
    () => (templatesQuery.data ?? []).filter((t) =>
      !isSearching || t.name.toLowerCase().includes(deferredSearchQuery.trim().toLowerCase()),
    ),
    [templatesQuery.data, isSearching, deferredSearchQuery],
  )

  const isItemPending = useCallback((fs: FoodSource) => {
    return items.some((i) =>
      fs.sourceType === 'user_product' ? i.productId === fs.sourceId : i.catalogItemId === fs.sourceId,
    )
  }, [items])

  const handleFoodTap = useCallback((foodSource: FoodSource) => {
    const existing = items.find((i) =>
      foodSource.sourceType === 'user_product'
        ? i.productId === foodSource.sourceId
        : i.catalogItemId === foodSource.sourceId,
    )

    reinitializeServingDraft(foodSource, existing)
    setServingTarget(foodSource)
    setSheetView('serving')
  }, [items, reinitializeServingDraft])

  const confirmServing = useCallback(() => {
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
  }, [servingTarget, pendingMode, massInputMode, pendingGrams, pendingPortions])

  const handleServingRemove = useCallback(() => {
    if (!servingTarget) return
    setItems((prev) => prev.filter((i) =>
      servingTarget.sourceType === 'user_product'
        ? i.productId !== servingTarget.sourceId
        : i.catalogItemId !== servingTarget.sourceId,
    ))
    setSheetView('browse')
  }, [servingTarget])

  const handleLogTemplate = useCallback(async (template: MealTemplate) => {
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
      invalidateFoodSources()
      invalidateTemplates()
      onAdded?.(result)
      onClose()
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to log template')
    } finally {
      setSubmitting(false)
    }
  }, [logDate, loggedAt, mealType, invalidateDailyLog, invalidateFoodSources, invalidateTemplates, onAdded, onClose])

  const handleDeleteTemplate = useCallback(async (templateId: string) => {
    try {
      await deleteMealTemplate(templateId)
      invalidateTemplates()
    } catch {
      // silently ignore
    }
  }, [invalidateTemplates])

  const handleSubmit = useCallback(async () => {
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
      invalidateFoodSources()
      onAdded?.(result)
      onClose()
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to save meal')
    } finally {
      setSubmitting(false)
    }
  }, [items, submitting, onItemsSelected, logDate, loggedAt, mealType, invalidateDailyLog, invalidateFoodSources, onAdded, onClose])

  const browseTranslate = sheetView === 'browse' ? 'translateX(0)' : 'translateX(-100%)'
  const detailTranslate = (sheetView === 'serving' || sheetView === 'create') ? 'translateX(0)' : 'translateX(100%)'
  const scanTranslate = sheetView === 'scan' ? 'translateX(0)' : 'translateX(100%)'

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

  const isEditingExisting = useMemo(
    () =>
      servingTarget
        ? items.some((i) =>
            servingTarget.sourceType === 'user_product'
              ? i.productId === servingTarget.sourceId
              : i.catalogItemId === servingTarget.sourceId,
          )
        : false,
    [servingTarget, items],
  )
  const browseSubmitDisabled = useMemo(() => items.length === 0 || submitting, [items.length, submitting])
  const isCompositeWithPieces = useMemo(
    () => Boolean(servingTarget && isCompositeWithPiecesForFood(servingTarget)),
    [servingTarget],
  )
  const servingConfirmDisabled = useMemo(
    () =>
      servingTarget
        ? isConfirmDisabledForFood(servingTarget, {
            pendingMode,
            massInputMode,
            pendingGrams,
            pendingPortions,
          })
        : true,
    [servingTarget, pendingMode, massInputMode, pendingGrams, pendingPortions],
  )
  const mealCtaStyle = useMemo(
    () =>
      mealTheme
        ? {
            background: mealTheme.accent,
            boxShadow: `0 10px 24px ${mealTheme.buttonShadow}`,
          }
        : undefined,
    [mealTheme],
  )
  const mealCtaDisabledStyle = useMemo(
    () =>
      mealTheme
        ? {
            background: mealTheme.bg,
            color: mealTheme.text,
            boxShadow: 'none',
          }
        : undefined,
    [mealTheme],
  )

  const getPendingItemServingLabel = useCallback((item: Item): string => {
    if (item.compositeQuantityMode === 'pieces') {
      return `${item.quantity} ${item.foodSource?.pieceLabel ?? 'pc'}`
    }
    return `${Math.round(item.quantity * getItemServingAmount())}g`
  }, [])

  const onMassInputModeChange = useCallback(
    (mode: 'grams' | 'portions') => {
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
    },
    [servingTarget, pendingGrams, pendingPortions, setMassInputMode, setPendingGrams, setPendingPortions],
  )

  const onOpenCreateFood = useCallback(() => {
    setProductFormPrefill(undefined)
    setSheetView('create')
  }, [])

  const onBarcodeProduct = useCallback((product: KassalappProduct) => {
    setProductFormPrefill({
      name: [product.brand, product.name].filter(Boolean).join(' – '),
      caloriesPer100g: product.caloriesPer100g,
      proteinPer100g: product.proteinPer100g,
      carbsPer100g: product.carbsPer100g,
      fatPer100g: product.fatPer100g,
      labelPortionGrams: product.labelPortionGrams,
    })
    setSheetView('create')
  }, [])

  const handleBarcodeEan = useCallback(async (ean: string) => {
    setScanLoading(true)
    setScanError(null)
    try {
      const product = await lookupBarcode(ean)
      if (product) {
        onBarcodeProduct(product)
      } else {
        setScanError('No product found for this barcode')
      }
    } catch (e) {
      setScanError(e instanceof Error ? e.message : 'Lookup failed')
    } finally {
      setScanLoading(false)
    }
  }, [onBarcodeProduct])

  const onServingBack = useCallback(() => {
    setSheetView('browse')
  }, [])

  const onProductSave = useCallback(() => {
    invalidateUserFoodLibrary()
    invalidateFoodSources({ includeSearch: true })
    setSheetView('browse')
  }, [invalidateUserFoodLibrary, invalidateFoodSources])

  const onProductSaveAndAdd = useCallback(
    (product: Product) => {
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
      invalidateUserFoodLibrary()
      invalidateFoodSources({ includeSearch: true })
      reinitializeServingDraft(foodSource)
      setServingTarget(foodSource)
      setSheetView('serving')
    },
    [invalidateUserFoodLibrary, invalidateFoodSources, reinitializeServingDraft],
  )

  const onProductCancel = useCallback(() => {
    setProductFormPrefill(undefined)
    setSheetView('browse')
  }, [])

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
            onOpenCreateFood={onOpenCreateFood}
            onBarcodeProduct={onBarcodeProduct}
            onOpenCameraScanner={() => { setScanError(null); setSheetView('scan') }}
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
          className="absolute inset-0 transition-transform duration-[250ms] ease-out"
          aria-hidden={sheetView !== 'scan'}
          style={{ transform: scanTranslate }}
        >
          <BarcodeScannerView
            active={sheetView === 'scan'}
            onEan={handleBarcodeEan}
            barcodeLoading={scanLoading}
            barcodeError={scanError}
            onCancel={() => setSheetView('browse')}
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
            onMassInputModeChange={onMassInputModeChange}
            pendingMode={pendingMode}
            onPendingModeChange={setPendingMode}
            servingEstimate={servingEstimate}
            isCompositeWithPieces={isCompositeWithPieces}
            isEditingExisting={isEditingExisting}
            onServingBack={onServingBack}
            onServingRemove={handleServingRemove}
            onProductSave={onProductSave}
            onProductSaveAndAdd={onProductSaveAndAdd}
            onProductCancel={onProductCancel}
            productFormPrefill={productFormPrefill}
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
