import { useMemo, useState } from 'react'
import BottomSheet from '@/components/ui/BottomSheet'
import GramInput from '@/components/ui/GramInput'
import ServingStep from './ServingStep'
import { getItemCalories, getItemLabel } from './itemHelpers'
import type { Item } from './types'

interface ServingEditSheetProps {
  item: Item
  idx: number
  onConfirm: (idx: number, quantity: number, compositeMode?: 'grams' | 'pieces') => void
  onClose: () => void
}

function formatAmount(value: number): string {
  return Number.isInteger(value) ? String(value) : parseFloat(value.toFixed(2)).toString()
}

export default function ServingEditSheet({ item, idx, onConfirm, onClose }: ServingEditSheetProps) {
  const [pendingGrams, setPendingGrams] = useState(() =>
    item.compositeQuantityMode === 'pieces' ? item.quantity : Math.round(item.quantity * 100),
  )
  const [pendingMode, setPendingMode] = useState<'grams' | 'pieces'>(() =>
    item.compositeQuantityMode === 'pieces' ? 'pieces' : 'grams',
  )
  const [massInputMode, setMassInputMode] = useState<'grams' | 'portions'>('grams')
  const [pendingPortions, setPendingPortions] = useState(() => {
    const labelGrams = item.foodSource?.labelPortionGrams
    const currentGrams = item.compositeQuantityMode === 'pieces' ? item.quantity : Math.round(item.quantity * 100)
    return labelGrams && labelGrams > 0
      ? Math.max(1, Math.round(currentGrams / labelGrams))
      : 1
  })

  const liveKcal = useMemo(() => {
    if (item.foodSource) {
      const densityPer100 = item.foodSource.caloriesPer100g ?? item.foodSource.calories
      const isCompositeWithPieces = item.foodSource.kind === 'composite'
        && (item.foodSource.pieceCount ?? 0) > 0
        && (item.foodSource.totalMassG ?? 0) > 0
      if (pendingMode === 'pieces' && isCompositeWithPieces) {
        const gramsPerPiece = item.foodSource.totalMassG! / item.foodSource.pieceCount!
        return Math.round(pendingGrams * (densityPer100 / 100) * gramsPerPiece)
      }
      const gramsEq =
        massInputMode === 'portions'
        && item.foodSource.labelPortionGrams
        && item.foodSource.labelPortionGrams > 0
          ? pendingPortions * item.foodSource.labelPortionGrams
          : pendingGrams
      return Math.round(gramsEq * (densityPer100 / 100))
    }

    if (item.compositeQuantityMode === 'pieces') {
      return Math.round(pendingGrams * getItemCalories(item))
    }

    return Math.round((pendingGrams / 100) * getItemCalories(item))
  }, [item, massInputMode, pendingGrams, pendingMode, pendingPortions])

  function handleUpdate() {
    if (item.foodSource) {
      const isCompositeWithPieces = item.foodSource.kind === 'composite'
        && (item.foodSource.pieceCount ?? 0) > 0
        && (item.foodSource.totalMassG ?? 0) > 0
      if (pendingMode === 'pieces' && isCompositeWithPieces) {
        if (pendingGrams <= 0) return
        onConfirm(idx, pendingGrams, 'pieces')
        return
      }

      const gramsEq =
        massInputMode === 'portions'
        && item.foodSource.labelPortionGrams
        && item.foodSource.labelPortionGrams > 0
          ? pendingPortions * item.foodSource.labelPortionGrams
          : pendingGrams
      if (gramsEq <= 0) return
      onConfirm(idx, gramsEq / 100, item.foodSource.kind === 'composite' ? 'grams' : undefined)
      return
    }

    if (item.compositeQuantityMode === 'pieces') {
      if (pendingGrams <= 0) return
      onConfirm(idx, pendingGrams, 'pieces')
      return
    }

    if (pendingGrams <= 0) return
    onConfirm(idx, pendingGrams / 100, item.compositeQuantityMode)
  }

  const footer = (
    <button
      type="button"
      onClick={handleUpdate}
      disabled={
        item.foodSource
          ? pendingMode === 'pieces'
            ? pendingGrams <= 0
            : massInputMode === 'portions'
              && item.foodSource.labelPortionGrams
              && item.foodSource.labelPortionGrams > 0
              ? pendingPortions <= 0
              : pendingGrams <= 0
          : pendingGrams <= 0
      }
      className="app-button-primary w-full py-3"
    >
      Update
    </button>
  )

  if (item.foodSource) {
    const isCompositeWithPieces = item.foodSource.kind === 'composite'
      && (item.foodSource.pieceCount ?? 0) > 0
      && (item.foodSource.totalMassG ?? 0) > 0

    return (
      <BottomSheet
        onClose={onClose}
        title={getItemLabel(item)}
        className="h-[85vh] sm:h-[600px]"
        footer={footer}
      >
        <ServingStep
          foodSource={item.foodSource}
          grams={pendingGrams}
          portions={pendingPortions}
          liveKcal={liveKcal}
          onGramsChange={setPendingGrams}
          onPortionsChange={setPendingPortions}
          massInputMode={massInputMode}
          onMassInputModeChange={(mode) => {
            setMassInputMode(mode)
            const labelGrams = item.foodSource?.labelPortionGrams
            if (mode === 'portions' && labelGrams && labelGrams > 0) {
              setPendingPortions(Math.max(1, Math.round(pendingGrams / labelGrams)))
            } else if (mode === 'grams' && labelGrams && labelGrams > 0) {
              setPendingGrams(Math.round(pendingPortions * labelGrams))
            }
          }}
          onBack={onClose}
          isUpdate
          compositeMode={pendingMode}
          onModeChange={setPendingMode}
          showModeToggle={isCompositeWithPieces}
        />
      </BottomSheet>
    )
  }

  const pieceUnit = item.snapshotServingUnit && item.snapshotServingUnit !== 'g'
    ? item.snapshotServingUnit
    : 'pc'

  return (
    <BottomSheet
      onClose={onClose}
      title={getItemLabel(item)}
      className="h-[480px] sm:h-[440px]"
      footer={footer}
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-8 py-6">
        <div className="text-center">
          <p className="text-6xl font-bold tabular-nums text-[var(--app-text-primary)] leading-none">
            {liveKcal}
          </p>
          <p className="mt-2 text-sm text-[var(--app-text-muted)]">kcal</p>
        </div>

        <div className="flex flex-col items-center gap-2">
          <GramInput
            grams={pendingGrams}
            onChange={setPendingGrams}
            showSteppers
            step={item.compositeQuantityMode === 'pieces' ? 1 : 10}
            {...(item.compositeQuantityMode === 'pieces'
              ? {
                  unitSuffix: pieceUnit,
                  quantityAriaLabel: 'Pieces',
                }
              : {})}
          />
          {item.compositeQuantityMode === 'pieces' ? (
            <p className="text-xs text-[var(--app-text-subtle)]">
              {formatAmount(pendingGrams)} {pieceUnit}
            </p>
          ) : (
            <p className="text-xs text-[var(--app-text-subtle)]">
              {formatAmount(pendingGrams)}g
            </p>
          )}
        </div>
      </div>
    </BottomSheet>
  )
}
