import FoodSourceBadge from '@/components/ui/FoodSourceBadge'
import GramInput from '@/components/ui/GramInput'
import SegmentedTabs from '@/components/ui/SegmentedTabs'
import type { FoodSource } from '@/types/domain'

export interface ServingStepProps {
  foodSource: FoodSource
  grams: number
  portions: number
  liveKcal: number
  onGramsChange: (g: number) => void
  onPortionsChange: (n: number) => void
  massInputMode: 'grams' | 'portions'
  onMassInputModeChange: (mode: 'grams' | 'portions') => void
  onBack: () => void
  isUpdate: boolean
  compositeMode: 'grams' | 'pieces'
  onModeChange: (mode: 'grams' | 'pieces') => void
  showModeToggle: boolean
}

export default function ServingStep({
  foodSource,
  grams,
  portions,
  liveKcal,
  onGramsChange,
  onPortionsChange,
  massInputMode,
  onMassInputModeChange,
  onBack,
  isUpdate,
  compositeMode,
  onModeChange,
  showModeToggle,
}: ServingStepProps) {
  void isUpdate

  const isPieceMode = compositeMode === 'pieces' && showModeToggle
  const gramsPerPiece = foodSource.totalMassG && foodSource.pieceCount && foodSource.pieceCount > 0
    ? foodSource.totalMassG / foodSource.pieceCount
    : null

  const labelPortionG = foodSource.labelPortionGrams
  const showLabelPortionTabs = Boolean(labelPortionG && labelPortionG > 0 && !showModeToggle)
  const portionStepperSuffix =
    foodSource.defaultServingUnit?.trim() && foodSource.defaultServingUnit !== 'g'
      ? foodSource.defaultServingUnit
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
          <FoodSourceBadge sourceType={foodSource.sourceType} />
          <p className="text-sm font-semibold text-[var(--app-text-primary)] truncate">{foodSource.name}</p>
        </div>
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
              unitSuffix={foodSource.pieceLabel ?? 'pc'}
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
          {isPieceMode && gramsPerPiece && foodSource.pieceLabel ? (
            <p className="text-xs text-[var(--app-text-subtle)]">
              1 {foodSource.pieceLabel} = {Math.round(gramsPerPiece)}g
            </p>
          ) : showLabelPortionTabs && massInputMode === 'portions' && labelPortionG ? (
            <p className="text-xs text-[var(--app-text-subtle)]">
              1 portion = {Math.round(labelPortionG)}g (from label)
            </p>
          ) : (
            foodSource.defaultServingUnit &&
            foodSource.defaultServingUnit !== 'g' &&
            foodSource.defaultServingAmount != null && (
              <p className="text-xs text-[var(--app-text-subtle)]">
                1 {foodSource.defaultServingUnit} = {foodSource.defaultServingAmount}g
              </p>
            )
          )}
        </div>
      </div>
    </div>
  )
}
