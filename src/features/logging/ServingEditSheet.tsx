import { useMemo, useState } from 'react'
import BottomSheet from '@/components/ui/BottomSheet'
import ServingStep from './ServingStep'
import { getItemCalories, getItemLabel, getItemSourceType } from './itemHelpers'
import type { Item } from './types'

interface ServingEditSheetProps {
  item: Item
  idx: number
  onConfirm: (idx: number, quantity: number, compositeMode?: 'grams' | 'pieces') => void | Promise<void>
  onClose: () => void
  confirmLabel?: string
}

export default function ServingEditSheet({ item, idx, onConfirm, onClose, confirmLabel = 'Update' }: ServingEditSheetProps) {
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
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const servingTarget = item.foodSource
    ? {
        name: item.foodSource.name,
        sourceType: item.foodSource.sourceType,
        defaultServingAmount: item.foodSource.defaultServingAmount,
        defaultServingUnit: item.foodSource.defaultServingUnit,
        labelPortionGrams: item.foodSource.labelPortionGrams,
        pieceCount: item.foodSource.pieceCount,
        pieceLabel: item.foodSource.pieceLabel,
        totalMassG: item.foodSource.totalMassG,
      }
    : {
        name: getItemLabel(item),
        sourceType: getItemSourceType(item) ?? undefined,
        defaultServingAmount: item.snapshotServingAmount ?? null,
        defaultServingUnit: item.snapshotServingUnit ?? null,
        labelPortionGrams: null,
        pieceCount: null,
        pieceLabel:
          item.snapshotServingUnit && item.snapshotServingUnit !== 'g'
            ? item.snapshotServingUnit
            : null,
        totalMassG: null,
      }

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

  async function handleUpdate() {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    if (item.foodSource) {
      const isCompositeWithPieces = item.foodSource.kind === 'composite'
        && (item.foodSource.pieceCount ?? 0) > 0
        && (item.foodSource.totalMassG ?? 0) > 0
      if (pendingMode === 'pieces' && isCompositeWithPieces) {
        if (pendingGrams <= 0) {
          setSubmitting(false)
          return
        }
        await submitConfirm(idx, pendingGrams, 'pieces')
        return
      }

      const gramsEq =
        massInputMode === 'portions'
        && item.foodSource.labelPortionGrams
        && item.foodSource.labelPortionGrams > 0
          ? pendingPortions * item.foodSource.labelPortionGrams
          : pendingGrams
      if (gramsEq <= 0) {
        setSubmitting(false)
        return
      }
      await submitConfirm(idx, gramsEq / 100, item.foodSource.kind === 'composite' ? 'grams' : undefined)
      return
    }

    if (item.compositeQuantityMode === 'pieces') {
      if (pendingGrams <= 0) {
        setSubmitting(false)
        return
      }
      await submitConfirm(idx, pendingGrams, 'pieces')
      return
    }

    if (pendingGrams <= 0) {
      setSubmitting(false)
      return
    }
    await submitConfirm(idx, pendingGrams / 100, item.compositeQuantityMode)
  }

  async function submitConfirm(idx: number, quantity: number, compositeMode?: 'grams' | 'pieces') {
    try {
      await onConfirm(idx, quantity, compositeMode)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update serving')
      setSubmitting(false)
    }
  }

  const isCompositeWithPieces = item.foodSource?.kind === 'composite'
    && (item.foodSource.pieceCount ?? 0) > 0
    && (item.foodSource.totalMassG ?? 0) > 0

  const footer = (
    <div className="space-y-2">
      {error ? (
        <p className="text-center text-sm text-[var(--app-danger)]">{error}</p>
      ) : null}
      <button
        type="button"
        onClick={() => void handleUpdate()}
        disabled={
          submitting ||
          (pendingMode === 'pieces'
            ? pendingGrams <= 0
            : massInputMode === 'portions'
              && servingTarget.labelPortionGrams
              && servingTarget.labelPortionGrams > 0
              ? pendingPortions <= 0
              : pendingGrams <= 0)
        }
        className="app-button-primary w-full py-3 disabled:opacity-50"
      >
        {submitting ? 'Updating...' : confirmLabel}
      </button>
    </div>
  )

  return (
    <BottomSheet
      onClose={onClose}
      title={getItemLabel(item)}
      className="h-[85vh] sm:h-[600px]"
      footer={footer}
    >
      <ServingStep
        target={servingTarget}
        grams={pendingGrams}
        portions={pendingPortions}
        liveKcal={liveKcal}
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
        onBack={onClose}
        isUpdate
        compositeMode={pendingMode}
        onModeChange={setPendingMode}
        showModeToggle={Boolean(isCompositeWithPieces)}
      />
    </BottomSheet>
  )
}
