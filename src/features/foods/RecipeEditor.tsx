import { Fragment, useEffect, useMemo, useState, useImperativeHandle } from 'react'
import type { ReactNode, Ref } from 'react'
import { useQuery } from '@tanstack/react-query'
import GramInput from '@/components/ui/GramInput'
import LoadingState from '@/components/ui/LoadingState'
import ServingEstimateBlock from '@/features/logging/ServingEstimateBlock'
import { getCompositeProduct, upsertCompositeProduct } from '@/features/foods/api'
import { computeRollup } from '@/features/foods/compositeRollup'
import type { CompositeIngredientInput } from '@/types/database'
import IngredientPickerSheet from './IngredientPickerSheet'
import { RecipeIngredientRow } from './RecipeIngredientRow'

function InsetRowDivider() {
  return <div aria-hidden className="mx-4 h-px bg-[var(--app-border-muted)]" />
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DraftIngredientRow {
  key: string
  sourceType: 'product' | 'catalog'
  sourceId: string
  name: string
  massG: number
  caloriesPer100g: number
  proteinPer100g: number | null
  carbsPer100g: number | null
  fatPer100g: number | null
}

export interface SaveHandle {
  save: () => Promise<void>
}

interface RecipeEditorProps {
  editProductId: string | null
  onSaved: () => void
  saveRef: Ref<SaveHandle>
  onCanSaveChange: (canSave: boolean) => void
  dangerZone?: ReactNode
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n < 10 ? n.toFixed(1) : Math.round(n).toString()
}

function nutritionDensityLine(
  label: string,
  data: { calories: number; protein: number; carbs: number; fat: number },
) {
  return (
    <p className="text-xs tabular-nums leading-snug text-[var(--app-text-muted)]">
      <span className="text-[var(--app-text-subtle)]">{label}</span>
      {' · '}
      {fmt(data.calories)} kcal · P {fmt(data.protein)}g · C {fmt(data.carbs)}g · F {fmt(data.fat)}g
    </p>
  )
}

function ingredientEstimateFromRow(row: DraftIngredientRow) {
  const scale = row.massG / 100
  return {
    kcal: Math.round((row.caloriesPer100g * row.massG) / 100),
    proteinG: row.proteinPer100g != null ? row.proteinPer100g * scale : null,
    carbsG: row.carbsPer100g != null ? row.carbsPer100g * scale : null,
    fatG: row.fatPer100g != null ? row.fatPer100g * scale : null,
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function RecipeEditor({
  editProductId,
  onSaved,
  saveRef,
  onCanSaveChange,
  dangerZone,
}: RecipeEditorProps) {
  const isEditMode = editProductId != null

  const [name, setName] = useState('')
  const [pieceCount, setPieceCount] = useState<number | null>(null)
  const [pieceLabel, setPieceLabel] = useState('')
  const [ingredients, setIngredients] = useState<DraftIngredientRow[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(!isEditMode)
  const [detailsExpanded, setDetailsExpanded] = useState(false)

  // ─── Edit mode: fetch existing composite ──────────────────────────────────

  const editQuery = useQuery({
    queryKey: ['composite-product', editProductId],
    enabled: isEditMode,
    queryFn: () => getCompositeProduct(editProductId!),
  })

  useEffect(() => {
    if (!isEditMode || !editQuery.data) return
    const cp = editQuery.data
    setName(cp.name)
    setPieceCount(cp.pieceCount)
    setPieceLabel(cp.pieceLabel ?? '')
    setIngredients(
      cp.ingredients.map((ing) => ({
        key: crypto.randomUUID(),
        sourceType: ing.sourceType,
        sourceId: ing.sourceId,
        name: ing.name,
        massG: ing.massG,
        caloriesPer100g: ing.caloriesPer100g,
        proteinPer100g: ing.proteinPer100g,
        carbsPer100g: ing.carbsPer100g,
        fatPer100g: ing.fatPer100g,
      })),
    )
    setInitialized(true)
  }, [isEditMode, editQuery.data])

  const recipeTotalMassG = useMemo(
    () => ingredients.reduce((sum, r) => sum + r.massG, 0),
    [ingredients],
  )

  const rollup = useMemo(
    () => computeRollup(ingredients, recipeTotalMassG, pieceCount),
    [ingredients, recipeTotalMassG, pieceCount],
  )

  // ─── canSave + saveRef ────────────────────────────────────────────────────

  const canSave =
    name.trim().length > 0 && ingredients.length > 0 && recipeTotalMassG > 0

  useEffect(() => {
    onCanSaveChange(canSave && !saving)
  }, [canSave, saving, onCanSaveChange])

  useImperativeHandle(saveRef, () => ({ save: handleSave }))

  // ─── Escape: go back from detail view ─────────────────────────────────────

  useEffect(() => {
    if (!selectedKey) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        setSelectedKey(null)
      }
    }
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [selectedKey])

  // ─── Ingredient actions ───────────────────────────────────────────────────

  function handleAddIngredient(row: DraftIngredientRow) {
    setIngredients((prev) => [...prev, row])
    setShowPicker(false)
  }

  function handleRemoveIngredient(key: string) {
    setIngredients((prev) => prev.filter((r) => r.key !== key))
    if (selectedKey === key) setSelectedKey(null)
  }

  function handleMassChange(key: string, massG: number) {
    setIngredients((prev) =>
      prev.map((r) => (r.key === key ? { ...r, massG } : r)),
    )
  }

  // ─── Save ─────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!canSave || saving) return
    setSaving(true)
    setServerError(null)

    const apiIngredients: CompositeIngredientInput[] = ingredients.map(
      (ing, i) => ({
        product_id: ing.sourceType === 'product' ? ing.sourceId : null,
        catalog_item_id: ing.sourceType === 'catalog' ? ing.sourceId : null,
        mass_g: ing.massG,
        sort_order: i,
      }),
    )

    try {
      await upsertCompositeProduct({
        productId: editProductId ?? null,
        name: name.trim(),
        totalMassG: recipeTotalMassG,
        pieceCount,
        pieceLabel: pieceCount && pieceCount > 0 && pieceLabel.trim() ? pieceLabel.trim() : null,
        ingredients: apiIngredients,
      })
      onSaved()
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Failed to save')
      throw err
    } finally {
      setSaving(false)
    }
  }

  // ─── Piece count helpers ──────────────────────────────────────────────────

  function handlePieceCountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    if (raw === '') { setPieceCount(null); return }
    const parsed = parseInt(raw, 10)
    if (!isNaN(parsed) && parsed >= 0) setPieceCount(parsed || null)
  }

  const excludeProductIds = ingredients
    .filter((r) => r.sourceType === 'product')
    .map((r) => r.sourceId)

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (isEditMode && !initialized) return <LoadingState />

  // ─── Render ───────────────────────────────────────────────────────────────

  const hasNutrition = ingredients.length > 0

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">

        {/* Always-visible header: name + nutrition summary */}
        <div className="flex-none border-b border-[var(--app-border-muted)] bg-white px-4 pb-2 pt-3">
          <div className="mb-2">
            <label
              htmlFor="comp-name"
              className="mb-1 block text-xs text-[var(--app-text-muted)]"
            >
              Name <span className="text-[var(--app-danger)]">*</span>
            </label>
            <input
              id="comp-name"
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="app-input px-3 py-2"
              placeholder="e.g. Spaghetti Bolognese"
            />
          </div>

          {/* Nutrition summary row — doubles as expand trigger */}
          <button
            type="button"
            onClick={() => setDetailsExpanded((p) => !p)}
            className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-[var(--app-hover-overlay)]"
            aria-expanded={detailsExpanded}
            aria-label={detailsExpanded ? 'Collapse recipe details' : 'Expand recipe details'}
          >
            {hasNutrition ? (
              <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1">
                  <span
                    className="rounded px-1 py-px text-[10px] font-bold tabular-nums"
                    style={{ color: 'var(--app-macro-protein)', background: 'var(--app-macro-protein-bg)' }}
                  >
                    P {fmt(rollup.totals.protein)}g
                  </span>
                  <span
                    className="rounded px-1 py-px text-[10px] font-bold tabular-nums"
                    style={{ color: 'var(--app-macro-carbs)', background: 'var(--app-macro-carbs-bg)' }}
                  >
                    C {fmt(rollup.totals.carbs)}g
                  </span>
                  <span
                    className="rounded px-1 py-px text-[10px] font-bold tabular-nums"
                    style={{ color: 'var(--app-macro-fat)', background: 'var(--app-macro-fat-bg)' }}
                  >
                    F {fmt(rollup.totals.fat)}g
                  </span>
                </div>
                <div className="flex shrink-0 items-baseline gap-0.5">
                  <span
                    className="text-[15px] font-extrabold tabular-nums"
                    style={{ color: 'var(--app-text-primary)' }}
                  >
                    {Math.round(rollup.totals.calories)}
                  </span>
                  <span
                    className="text-[10px] font-semibold"
                    style={{ color: 'var(--app-text-muted)' }}
                  >
                    kcal
                  </span>
                </div>
              </div>
            ) : (
              <span className="text-xs" style={{ color: 'var(--app-text-subtle)' }}>
                Add ingredients to see nutrition
              </span>
            )}
            <svg
              className={`h-4 w-4 flex-none transition-transform duration-200 ${detailsExpanded ? 'rotate-180' : ''}`}
              style={{ color: 'var(--app-text-subtle)' }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Expandable details: per-serving density + servings inputs */}
        {detailsExpanded && (
          <div className="flex-none space-y-3 border-b border-[var(--app-border-muted)] bg-white px-4 pb-3 pt-3">
            {hasNutrition && (rollup.per100g || (rollup.perPiece && pieceCount && pieceCount > 0)) && (
              <div className="space-y-1">
                {rollup.per100g && nutritionDensityLine('Per 100 g', rollup.per100g)}
                {rollup.perPiece && pieceCount && pieceCount > 0 &&
                  nutritionDensityLine(
                    `Per ${pieceLabel.trim() || 'piece'} (${fmt(recipeTotalMassG / pieceCount)} g)`,
                    rollup.perPiece,
                  )
                }
              </div>
            )}

            <section>
              <h2 className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--app-text-muted)]">
                Servings
              </h2>
              <div>
                <label
                  htmlFor="comp-pieces"
                  className="mb-1 block text-xs text-[var(--app-text-muted)]"
                >
                  Servings / pieces{' '}
                  <span className="text-[var(--app-text-subtle)]">(optional)</span>
                </label>
                <input
                  id="comp-pieces"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={pieceCount ?? ''}
                  onChange={handlePieceCountChange}
                  className="app-input px-3 py-2 text-sm"
                  placeholder="e.g. 4"
                />
              </div>

              {pieceCount != null && pieceCount > 0 && (
                <div className="mt-3">
                  <label
                    htmlFor="comp-piece-label"
                    className="mb-1 block text-xs text-[var(--app-text-muted)]"
                  >
                    Piece label
                  </label>
                  <input
                    id="comp-piece-label"
                    type="text"
                    value={pieceLabel}
                    onChange={(e) => setPieceLabel(e.target.value)}
                    className="app-input px-3 py-2 text-sm"
                    placeholder="e.g. slice"
                  />
                </div>
              )}
            </section>
          </div>
        )}

        {/* Sliding panels */}
        <div className="relative flex min-h-0 flex-1 overflow-hidden">

          {/* Browse panel: ingredient list */}
          <div
            className="absolute inset-0 flex min-h-0 flex-col transition-transform duration-[250ms] ease-out"
            style={{ transform: selectedKey ? 'translateX(-100%)' : 'translateX(0)' }}
          >
            <div className="flex-none border-b border-[var(--app-border-muted)] bg-white px-4 pb-2 pt-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--app-text-subtle)]">
                Ingredients <span className="text-[var(--app-danger)]">*</span>
              </p>
              <p className="mt-0.5 text-xs leading-snug text-[var(--app-text-muted)]">
                Pick foods and gram amounts — same idea as logging a meal.
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {ingredients.map((row, idx) => {
                  const scale = row.massG / 100
                  return (
                    <Fragment key={row.key}>
                      {idx > 0 && <InsetRowDivider />}
                      <RecipeIngredientRow
                        name={row.name}
                        massG={row.massG}
                        kcal={Math.round((row.caloriesPer100g * row.massG) / 100)}
                        proteinG={row.proteinPer100g != null ? row.proteinPer100g * scale : null}
                        carbsG={row.carbsPer100g != null ? row.carbsPer100g * scale : null}
                        fatG={row.fatPer100g != null ? row.fatPer100g * scale : null}
                        onTap={() => setSelectedKey(row.key)}
                      />
                    </Fragment>
                  )
                })}

              {ingredients.length > 0 && <InsetRowDivider />}
              <button
                type="button"
                onClick={() => setShowPicker(true)}
                className="flex w-full items-center gap-3 px-4 py-3 text-sm text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-hover-overlay)] hover:text-[var(--app-brand)]"
              >
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-xl border border-dashed border-[var(--app-border)] text-lg leading-none">
                  +
                </span>
                <span>Add ingredient</span>
              </button>

              {serverError && (
                <p className="px-4 pb-3 text-sm text-[var(--app-danger)]">{serverError}</p>
              )}
              {dangerZone && (
                <div className="px-4 pb-4">
                  {dangerZone}
                </div>
              )}
            </div>
          </div>

          {/* Detail panel: gram editor for selected ingredient */}
          <div
            className="absolute inset-0 flex flex-col transition-transform duration-[250ms] ease-out"
            style={{ transform: selectedKey ? 'translateX(0)' : 'translateX(100%)' }}
          >
            {(() => {
              const row = ingredients.find((r) => r.key === selectedKey)
              if (!row) return null
              const est = ingredientEstimateFromRow(row)
              return (
                <div className="flex flex-1 flex-col overflow-hidden">
                  <div className="flex-none flex items-center gap-3 border-b border-[var(--app-border-muted)] px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setSelectedKey(null)}
                      className="flex h-9 w-9 flex-none items-center justify-center rounded-xl text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-hover-overlay)]"
                      aria-label="Back to ingredient list"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span
                        className="h-2 w-2 flex-none rounded-full bg-[var(--app-text-muted)] opacity-35"
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--app-text-subtle)]">
                          Ingredient
                        </p>
                        <p className="truncate text-sm font-semibold text-[var(--app-text-primary)]">
                          {row.name}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveIngredient(row.key)}
                      className="flex h-9 w-9 flex-none items-center justify-center rounded-xl text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-danger-soft)] hover:text-[var(--app-danger)]"
                      aria-label={`Remove ${row.name}`}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  <div className="flex flex-1 flex-col overflow-y-auto px-5 pb-5 pt-4">
                    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
                      <ServingEstimateBlock
                        kcal={est.kcal}
                        proteinG={est.proteinG}
                        carbsG={est.carbsG}
                        fatG={est.fatG}
                        description="For this amount in the recipe"
                        showEyebrow={false}
                        macros="pills"
                      />
                      <section className="pt-6">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-text-subtle)]">
                          How much?
                        </p>
                        <p className="mt-1 text-sm text-[var(--app-text-muted)]">
                          Same idea as logging a meal — set grams for this ingredient in the batch.
                        </p>
                      </section>
                      <section className="mt-auto flex flex-col items-center pb-2 pt-8">
                        <GramInput
                          grams={row.massG}
                          onChange={(g) => handleMassChange(row.key, g)}
                          step={10}
                          showSteppers
                          size="large"
                        />
                      </section>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      </div>

      {showPicker && (
        <IngredientPickerSheet
          onClose={() => setShowPicker(false)}
          onAdd={handleAddIngredient}
          excludeProductIds={excludeProductIds}
        />
      )}
    </>
  )
}
