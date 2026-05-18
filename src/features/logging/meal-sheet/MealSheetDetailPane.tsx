import type { ReactNode } from 'react'
import type { FoodSource, Product } from '@/types/domain'
import ProductForm, { type ProductFormPrefill } from '../ProductForm'
import ServingStep from '../ServingStep'
import type { ServingStepEstimate } from '../ServingStep'
import { servingStepTargetFromFood } from '../servingDraftModel'
import type { FoodSourceServingDraftBundle } from '../useServingDraft'

type SheetView = 'browse' | 'serving' | 'create'

export interface MealSheetDetailPaneProps {
  sheetView: SheetView
  servingTarget: FoodSource | null
  servingDraft: FoodSourceServingDraftBundle
  onMassInputModeChange: (mode: 'grams' | 'portions') => void
  servingEstimate: ServingStepEstimate
  isCompositeWithPieces: boolean
  isEditingExisting: boolean
  onServingBack: () => void
  onServingRemove: () => void
  onProductSave: () => void
  onProductSaveAndAdd: (product: Product) => void
  productFormPrefill?: ProductFormPrefill
  servingFooter: ReactNode
}

export default function MealSheetDetailPane({
  sheetView,
  servingTarget,
  servingDraft,
  onMassInputModeChange,
  servingEstimate,
  isCompositeWithPieces,
  isEditingExisting,
  onServingBack,
  onServingRemove,
  onProductSave,
  onProductSaveAndAdd,
  productFormPrefill,
  servingFooter,
}: MealSheetDetailPaneProps) {
  const { pendingGrams, pendingPortions, massInputMode, pendingMode,
          setPendingGrams, setPendingPortions, setPendingMode } = servingDraft
  return (
    <>
      {sheetView === 'serving' && servingTarget && (
        <ServingStep
          target={servingStepTargetFromFood(servingTarget)}
          grams={pendingGrams}
          portions={pendingPortions}
          estimate={servingEstimate}
          onGramsChange={setPendingGrams}
          onPortionsChange={setPendingPortions}
          massInputMode={massInputMode}
          onMassInputModeChange={onMassInputModeChange}
          onBack={onServingBack}
          isUpdate={isEditingExisting}
          onRemove={isEditingExisting ? onServingRemove : undefined}
          compositeMode={pendingMode}
          onModeChange={setPendingMode}
          showModeToggle={isCompositeWithPieces}
        />
      )}
      {sheetView === 'serving' && servingTarget && servingFooter}
      {sheetView === 'create' && (
        <div className="flex-1 overflow-y-auto">
          <ProductForm
            initialValues={productFormPrefill}
            onSave={onProductSave}
            onSaveAndAdd={onProductSaveAndAdd}
          />
        </div>
      )}
    </>
  )
}
