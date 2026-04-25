import FoodSourceBadge from '@/components/ui/FoodSourceBadge'
import GramInput from '@/components/ui/GramInput'
import SegmentedTabs from '@/components/ui/SegmentedTabs'

type ServingAmountMode = 'grams' | 'portions' | 'pieces'

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
  const isPieceMode = compositeMode === 'pieces'
  const gramsPerPiece = target.totalMassG && target.pieceCount && target.pieceCount > 0
    ? target.totalMassG / target.pieceCount
    : null

  const labelPortionG = target.labelPortionGrams
  const canUseLabelPortions = Boolean(labelPortionG && labelPortionG > 0)
  const selectedAmountMode: ServingAmountMode = isPieceMode
    ? 'pieces'
    : canUseLabelPortions && massInputMode === 'portions'
      ? 'portions'
      : 'grams'
  const amountModeOptions: Array<{ value: ServingAmountMode; label: string }> = [
    { value: 'grams', label: 'Weight' },
    ...(canUseLabelPortions ? [{ value: 'portions' as const, label: 'Label serving' }] : []),
    ...(showModeToggle ? [{ value: 'pieces' as const, label: 'Pieces' }] : []),
  ]
  const portionStepperSuffix =
    target.defaultServingUnit?.trim() && target.defaultServingUnit !== 'g'
      ? target.defaultServingUnit
      : 'portion'
  const servingActionLabel = isUpdate ? 'Edit serving' : 'Add serving'
  const pieceUnit = target.pieceLabel ?? 'pc'
  const quickChoices =
    selectedAmountMode === 'pieces'
      ? [
          { label: `1 ${pieceUnit}`, value: 1 },
          { label: `2 ${pieceUnit}`, value: 2 },
          ...(target.pieceCount && target.pieceCount > 2
            ? [{ label: `All ${target.pieceCount}`, value: target.pieceCount }]
            : []),
        ]
      : selectedAmountMode === 'portions'
        ? [
            { label: `1 ${portionStepperSuffix}`, value: 1 },
            { label: `2 ${portionStepperSuffix}`, value: 2 },
          ]
        : [
            ...(target.defaultServingAmount && target.defaultServingUnit && target.defaultServingUnit !== 'g'
              ? [{ label: `1 ${target.defaultServingUnit}`, value: target.defaultServingAmount }]
              : []),
            ...(labelPortionG ? [{ label: 'Label serving', value: Math.round(labelPortionG) }] : []),
            { label: '100g', value: 100 },
          ]
  const quickChoiceGridClass =
    quickChoices.length === 1
      ? 'grid-cols-1'
      : quickChoices.length === 2
        ? 'grid-cols-2'
        : 'grid-cols-3'

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

  function handleAmountModeChange(mode: ServingAmountMode) {
    if (mode === selectedAmountMode) return

    if (mode === 'pieces') {
      if (massInputMode !== 'grams') onMassInputModeChange('grams')
      handleCompositeModeSwitch('pieces')
      return
    }

    if (isPieceMode) {
      onMassInputModeChange(mode)
      if (gramsPerPiece) {
        const nextGrams = Math.round(grams * gramsPerPiece)
        onGramsChange(nextGrams)
        if (mode === 'portions' && labelPortionG) {
          onPortionsChange(Math.max(1, Math.round(nextGrams / labelPortionG)))
        }
      }
      onModeChange('grams')
      return
    }

    onMassInputModeChange(mode)
  }

  function handleQuickChoice(value: number) {
    if (selectedAmountMode === 'portions') {
      onPortionsChange(value)
      if (labelPortionG) onGramsChange(Math.round(value * labelPortionG))
      return
    }
    onGramsChange(value)
  }

  const conversionHint = isPieceMode
    ? gramsPerPiece && target.pieceLabel
      ? `1 ${target.pieceLabel} = ${Math.round(gramsPerPiece)}g`
      : target.pieceLabel
        ? `Unit: ${target.pieceLabel}`
        : null
    : selectedAmountMode === 'portions' && labelPortionG
      ? `1 ${portionStepperSuffix} = ${Math.round(labelPortionG)}g from label`
      : target.defaultServingUnit &&
          target.defaultServingUnit !== 'g' &&
          target.defaultServingAmount != null
        ? `1 ${target.defaultServingUnit} = ${target.defaultServingAmount}g`
        : null

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
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--app-text-subtle)]">
              {servingActionLabel}
            </p>
            <p className="text-sm font-semibold text-[var(--app-text-primary)] truncate">{target.name}</p>
          </div>
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

      <div className="flex flex-1 flex-col overflow-y-auto px-5 pb-5 pt-4">
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
          <section className="border-b border-[var(--app-border-muted)] pb-5">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--app-text-subtle)]">
              Estimate
            </p>
            <div className="mt-2 flex items-end justify-between gap-4">
              <p className="max-w-[11rem] text-sm leading-5 text-[var(--app-text-muted)]">
                Calories for this serving
              </p>
              <div className="text-right">
                <p className="text-5xl font-bold leading-none tabular-nums text-[var(--app-text-primary)]">
                  {liveKcal}
                </p>
                <p className="mt-1 text-xs font-medium text-[var(--app-text-muted)]">kcal</p>
              </div>
            </div>
          </section>

          <section className="pt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-text-subtle)]">
              How much?
            </p>
            <p className="mt-1 text-sm text-[var(--app-text-muted)]">
              Choose the way you measured this serving.
            </p>

            {amountModeOptions.length > 1 && (
              <SegmentedTabs
                value={selectedAmountMode}
                options={amountModeOptions}
                onChange={handleAmountModeChange}
                className="!mt-4 !bg-transparent !px-0 !py-0 !shadow-none"
              />
            )}
          </section>

          <section className="mt-auto flex flex-col items-center gap-4 pb-2 pt-8">
            {quickChoices.length > 0 && (
              <div className="w-full space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--app-text-subtle)]">
                  Quick amounts
                </p>
                <div className={`grid ${quickChoiceGridClass} gap-2`}>
                  {quickChoices.map((choice) => (
                    <button
                      key={`${choice.label}-${choice.value}`}
                      type="button"
                      onClick={() => handleQuickChoice(choice.value)}
                      className="min-h-10 rounded-xl border border-[var(--app-input-border)] bg-[var(--app-input-bg)] px-2 text-sm font-semibold text-[var(--app-text-primary)] shadow-[var(--app-input-shadow)] transition-[background-color,border-color,color,box-shadow] hover:bg-[var(--app-input-bg-focus)] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--app-brand-ring),var(--app-input-shadow-focus)]"
                    >
                      {choice.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col items-center gap-3">
              {isPieceMode ? (
                <GramInput
                  grams={grams}
                  onChange={onGramsChange}
                  showSteppers
                  step={1}
                  unitSuffix={pieceUnit}
                  quantityAriaLabel="Pieces"
                  size="large"
                />
              ) : selectedAmountMode === 'portions' ? (
                <GramInput
                  grams={portions}
                  onChange={onPortionsChange}
                  showSteppers
                  step={1}
                  unitSuffix={portionStepperSuffix}
                  quantityAriaLabel="Label servings"
                  size="large"
                />
              ) : (
                <GramInput grams={grams} onChange={onGramsChange} showSteppers step={10} size="large" />
              )}

              <div className="min-h-4">
                {conversionHint ? (
                  <p className="text-center text-xs text-[var(--app-text-subtle)]">{conversionHint}</p>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
