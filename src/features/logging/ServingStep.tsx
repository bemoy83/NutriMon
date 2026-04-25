import FoodSourceBadge from '@/components/ui/FoodSourceBadge'
import GramInput from '@/components/ui/GramInput'
import SegmentedTabs from '@/components/ui/SegmentedTabs'

export interface ServingStepTarget {
  name: string
  sourceType?: 'user_product' | 'catalog_item'
  defaultServingAmount: number | null
  defaultServingUnit: string | null
  labelPortionGrams: number | null
  pieceCount: number | null
  pieceLabel: string | null
  totalMassG: number | null
}

export interface ServingStepProps {
  target: ServingStepTarget
  grams: number
  portions: number
  liveKcal: number
  onGramsChange: (g: number) => void
  onPortionsChange: (n: number) => void
  massInputMode: 'grams' | 'portions'
  onMassInputModeChange: (mode: 'grams' | 'portions') => void
  onBack: () => void
  isUpdate: boolean
  onRemove?: () => void
  compositeMode: 'grams' | 'pieces'
  onModeChange: (mode: 'grams' | 'pieces') => void
  showModeToggle: boolean
}

export default function ServingStep({
  target,
  grams,
  portions,
  liveKcal,
  onGramsChange,
  onPortionsChange,
  massInputMode,
  onMassInputModeChange,
  onBack,
  isUpdate,
  onRemove,
  compositeMode,
  onModeChange,
  showModeToggle,
}: ServingStepProps) {
  void isUpdate

  const isPieceMode = compositeMode === 'pieces'
  const gramsPerPiece = target.totalMassG && target.pieceCount && target.pieceCount > 0
    ? target.totalMassG / target.pieceCount
    : null

  const labelPortionG = target.labelPortionGrams
  const showLabelPortionTabs = Boolean(labelPortionG && labelPortionG > 0 && !showModeToggle && !isPieceMode)
  const portionStepperSuffix =
    target.defaultServingUnit?.trim() && target.defaultServingUnit !== 'g'
      ? target.defaultServingUnit
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
          {target.sourceType ? (
            <FoodSourceBadge sourceType={target.sourceType} />
          ) : (
            <span className="h-2 w-2 flex-none rounded-full bg-[var(--app-text-muted)] opacity-35" aria-hidden="true" />
          )}
          <p className="text-sm font-semibold text-[var(--app-text-primary)] truncate">{target.name}</p>
        </div>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="flex-none h-9 w-9 flex items-center justify-center rounded-full text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-danger-soft)] hover:text-[var(--app-danger)]"
            aria-label="Remove item"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
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
              unitSuffix={target.pieceLabel ?? 'pc'}
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
          {isPieceMode ? (
            gramsPerPiece && target.pieceLabel ? (
              <p className="text-xs text-[var(--app-text-subtle)]">
                1 {target.pieceLabel} = {Math.round(gramsPerPiece)}g
              </p>
            ) : target.pieceLabel ? (
              <p className="text-xs text-[var(--app-text-subtle)]">
                Unit: {target.pieceLabel}
              </p>
            ) : null
          ) : showLabelPortionTabs && massInputMode === 'portions' && labelPortionG ? (
            <p className="text-xs text-[var(--app-text-subtle)]">
              1 portion = {Math.round(labelPortionG)}g (from label)
            </p>
          ) : (
            target.defaultServingUnit &&
            target.defaultServingUnit !== 'g' &&
            target.defaultServingAmount != null && (
              <p className="text-xs text-[var(--app-text-subtle)]">
                1 {target.defaultServingUnit} = {target.defaultServingAmount}g
              </p>
            )
          )}
        </div>
      </div>
    </div>
  )
}
