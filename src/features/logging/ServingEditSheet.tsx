import { useState } from 'react'
import BottomSheet from '@/components/ui/BottomSheet'
import ServingStep from './ServingStep'
import { getItemLabel } from './itemHelpers'
import type { Item } from './types'
import { isCompositeWithPiecesForFood } from './servingDraftModel'
import { useItemServingDraftState } from './useServingDraft'

interface ServingEditSheetProps {
  item: Item
  idx: number
  onConfirm: (idx: number, quantity: number, compositeMode?: 'grams' | 'pieces') => void | Promise<void>
  onClose: () => void
  onRemove?: () => void | Promise<void>
  confirmLabel?: string
}

export default function ServingEditSheet({
  item,
  idx,
  onConfirm,
  onClose,
  onRemove,
  confirmLabel = 'Update',
}: ServingEditSheetProps) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    pendingGrams,
    setPendingGrams,
    pendingPortions,
    setPendingPortions,
    massInputMode,
    pendingMode,
    setPendingMode,
    target,
    liveKcal,
    confirmDisabled,
    confirmPayload,
    onMassInputModeChange,
  } = useItemServingDraftState(item)

  async function handleUpdate() {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    const payload = confirmPayload()
    if (!payload) {
      setSubmitting(false)
      return
    }
    try {
      await onConfirm(idx, payload.quantity, payload.compositeQuantityMode)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update serving')
    } finally {
      setSubmitting(false)
    }
  }

  const showCompositeToggle = isCompositeWithPiecesForFood(item.foodSource ?? undefined)

  const footer = (
    <div className="space-y-2">
      {error ? (
        <p className="text-center text-sm text-[var(--app-danger)]">{error}</p>
      ) : null}
      <button
        type="button"
        onClick={() => void handleUpdate()}
        disabled={submitting || confirmDisabled}
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
        target={target}
        grams={pendingGrams}
        portions={pendingPortions}
        liveKcal={liveKcal}
        onGramsChange={setPendingGrams}
        onPortionsChange={setPendingPortions}
        massInputMode={massInputMode}
        onMassInputModeChange={onMassInputModeChange}
        onBack={onClose}
        isUpdate
        onRemove={onRemove}
        compositeMode={pendingMode}
        onModeChange={setPendingMode}
        showModeToggle={showCompositeToggle}
      />
    </BottomSheet>
  )
}
