import type { ReactNode } from 'react'
import type { FoodSource, Product } from '@/types/domain'
import ProductForm from '../ProductForm'
import ServingStep from '../ServingStep'
import { servingStepTargetFromFood } from '../servingDraftModel'

type SheetView = 'browse' | 'serving' | 'create'

export interface MealSheetDetailPaneProps {
  sheetView: SheetView
  servingTarget: FoodSource | null
  pendingGrams: number
  onPendingGramsChange: (n: number | ((g: number) => number)) => void
  pendingPortions: number
  onPendingPortionsChange: (n: number | ((g: number) => number)) => void
  massInputMode: 'grams' | 'portions'
  onMassInputModeChange: (mode: 'grams' | 'portions') => void
  pendingMode: 'grams' | 'pieces'
  onPendingModeChange: (m: 'grams' | 'pieces') => void
  servingLiveKcal: number
  isCompositeWithPieces: boolean
  isEditingExisting: boolean
  onServingBack: () => void
  onServingRemove: () => void
  onProductSave: () => void
  onProductSaveAndAdd: (product: Product) => void
  onProductCancel: () => void
  servingFooter: ReactNode
}

export default function MealSheetDetailPane({
  sheetView,
  servingTarget,
  pendingGrams,
  onPendingGramsChange,
  pendingPortions,
  onPendingPortionsChange,
  massInputMode,
  onMassInputModeChange,
  pendingMode,
  onPendingModeChange,
  servingLiveKcal,
  isCompositeWithPieces,
  isEditingExisting,
  onServingBack,
  onServingRemove,
  onProductSave,
  onProductSaveAndAdd,
  onProductCancel,
  servingFooter,
}: MealSheetDetailPaneProps) {
  return (
    <>
      {sheetView === 'serving' && servingTarget && (
        <ServingStep
          target={servingStepTargetFromFood(servingTarget)}
          grams={pendingGrams}
          portions={pendingPortions}
          liveKcal={servingLiveKcal}
          onGramsChange={onPendingGramsChange}
          onPortionsChange={onPendingPortionsChange}
          massInputMode={massInputMode}
          onMassInputModeChange={onMassInputModeChange}
          onBack={onServingBack}
          isUpdate={isEditingExisting}
          onRemove={isEditingExisting ? onServingRemove : undefined}
          compositeMode={pendingMode}
          onModeChange={onPendingModeChange}
          showModeToggle={isCompositeWithPieces}
        />
      )}
      {sheetView === 'serving' && servingTarget && servingFooter}
      {sheetView === 'create' && (
        <div className="flex-1 overflow-y-auto">
          <ProductForm
            onSave={onProductSave}
            onSaveAndAdd={onProductSaveAndAdd}
            onCancel={onProductCancel}
          />
        </div>
      )}
    </>
  )
}
