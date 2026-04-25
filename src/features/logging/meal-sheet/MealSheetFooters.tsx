import type { CSSProperties } from 'react'

export function MealSheetBrowseFooter({
  submitError,
  itemsCount,
  mealType,
  totalKcal,
  submitting,
  browseSubmitDisabled,
  mealCtaStyle,
  mealCtaDisabledStyle,
  onSubmit,
}: {
  submitError: string | null
  itemsCount: number
  mealType: string
  totalKcal: number
  submitting: boolean
  browseSubmitDisabled: boolean
  mealCtaStyle: CSSProperties | undefined
  mealCtaDisabledStyle: CSSProperties | undefined
  onSubmit: () => void
}) {
  return (
    <div className="flex-none border-t border-[var(--app-border-muted)] bg-white px-4 py-5">
      {submitError && <p className="pb-2 text-xs text-[var(--app-danger)]">{submitError}</p>}
      {itemsCount === 0 && (
        <p className="pb-2 text-xs text-center text-[var(--app-text-subtle)]">
          Tap a food to add it to {mealType}
        </p>
      )}
      <button
        type="button"
        onClick={onSubmit}
        disabled={browseSubmitDisabled}
        className="app-button-primary w-full py-3 !rounded-xl"
        style={browseSubmitDisabled ? mealCtaDisabledStyle : mealCtaStyle}
      >
        {submitting
          ? 'Adding…'
          : itemsCount > 0
            ? `Add to ${mealType} · ${itemsCount} item${itemsCount !== 1 ? 's' : ''} · ${totalKcal} kcal`
            : `Add to ${mealType}`}
      </button>
    </div>
  )
}

export function MealSheetServingFooter({
  servingConfirmDisabled,
  mealCtaStyle,
  mealCtaDisabledStyle,
  isEditingExisting,
  mealType,
  onConfirm,
}: {
  servingConfirmDisabled: boolean
  mealCtaStyle: CSSProperties | undefined
  mealCtaDisabledStyle: CSSProperties | undefined
  isEditingExisting: boolean
  mealType: string
  onConfirm: () => void
}) {
  return (
    <div className="flex-none border-t border-[var(--app-border-muted)] bg-white px-4 py-5">
      <button
        type="button"
        onClick={onConfirm}
        disabled={servingConfirmDisabled}
        className="app-button-primary w-full py-3 !rounded-xl"
        style={servingConfirmDisabled ? mealCtaDisabledStyle : mealCtaStyle}
      >
        {isEditingExisting ? 'Update' : `Add to ${mealType}`}
      </button>
    </div>
  )
}
