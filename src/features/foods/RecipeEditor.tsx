import { useEffect, useMemo, useState, useImperativeHandle } from 'react'
import type { Ref } from 'react'
import { useQuery } from '@tanstack/react-query'
import FoodRow from '@/components/ui/FoodRow'
import KcalGramEditor from '@/components/ui/KcalGramEditor'
import LoadingState from '@/components/ui/LoadingState'
import { getCompositeProduct, upsertCompositeProduct } from '@/features/foods/api'
import { computeRollup } from '@/features/foods/compositeRollup'
import type { CompositeIngredientInput } from '@/types/database'
import IngredientPickerSheet from './IngredientPickerSheet'

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
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n < 10 ? n.toFixed(1) : Math.round(n).toString()
}

function NutritionRow({
  label,
  data,
  fmt,
}: {
  label: string
  data: { calories: number; protein: number; carbs: number; fat: number }
  fmt: (n: number) => string
}) {
  return (
    <div>
      <p className="text-xs text-[var(--app-text-muted)] mb-0.5">{label}</p>
      <p className="text-sm text-[var(--app-text-primary)]">
        {fmt(data.calories)} kcal
        <span className="text-[var(--app-text-muted)]">
          {' '}· P {fmt(data.protein)}g
          {' '}· C {fmt(data.carbs)}g
          {' '}· F {fmt(data.fat)}g
        </span>
      </p>
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function RecipeEditor({
  editProductId,
  onSaved,
  saveRef,
  onCanSaveChange,
}: RecipeEditorProps) {
  const isEditMode = editProductId != null

  const [name, setName] = useState('')
  const [totalMassG, setTotalMassG] = useState(0)
  const [pieceCount, setPieceCount] = useState<number | null>(null)
  const [pieceLabel, setPieceLabel] = useState('')
  const [ingredients, setIngredients] = useState<DraftIngredientRow[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(!isEditMode)

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
    setTotalMassG(cp.totalMassG)
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

  // ─── Live rollup ──────────────────────────────────────────────────────────

  const rollup = useMemo(
    () => computeRollup(ingredients, totalMassG, pieceCount),
    [ingredients, totalMassG, pieceCount],
  )

  // ─── canSave + saveRef ────────────────────────────────────────────────────

  const canSave = name.trim().length > 0 && totalMassG > 0 && ingredients.length > 0

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
        totalMassG,
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

  const rawMassSum = ingredients.reduce((sum, r) => sum + r.massG, 0)

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (isEditMode && !initialized) return <LoadingState />

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <div className="flex flex-col min-h-0 flex-1">
        {/* Always-visible metadata band */}
        <div className="flex-none bg-white px-4 pt-3 pb-4 space-y-3 border-b border-[var(--app-border-muted)]">
          <div>
            <label htmlFor="comp-name" className="block text-xs text-[var(--app-text-muted)] mb-1">
              Recipe name <span className="text-[var(--app-danger)]">*</span>
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="comp-mass" className="block text-xs text-[var(--app-text-muted)] mb-1">
                Prepared weight (g) <span className="text-[var(--app-danger)]">*</span>
              </label>
              <input
                id="comp-mass"
                type="number"
                inputMode="numeric"
                min={1}
                value={totalMassG || ''}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10)
                  setTotalMassG(isNaN(v) ? 0 : Math.max(0, v))
                }}
                className="app-input px-3 py-2 text-sm"
                placeholder="800"
              />
            </div>
            <div>
              <label htmlFor="comp-pieces" className="block text-xs text-[var(--app-text-muted)] mb-1">
                Servings / pieces
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
          </div>

          {pieceCount != null && pieceCount > 0 && (
            <div>
              <label htmlFor="comp-piece-label" className="block text-xs text-[var(--app-text-muted)] mb-1">
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
        </div>

        {/* Sliding panels */}
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          {/* Browse panel: ingredient list + nutrition preview */}
          <div
            className="absolute inset-0 flex flex-col transition-transform duration-[250ms] ease-out"
            style={{ transform: selectedKey ? 'translateX(-100%)' : 'translateX(0)' }}
          >
            <div className="flex-1 overflow-y-auto">
              <p className="px-4 pt-3 pb-1 text-[10px] font-semibold tracking-widest uppercase text-[var(--app-text-subtle)]">
                Ingredients <span className="text-[var(--app-danger)]">*</span>
              </p>

              <div className="divide-y divide-[var(--app-border-muted)]">
                {ingredients.map((row) => {
                  const kcal = Math.round(row.caloriesPer100g * row.massG / 100)
                  return (
                    <FoodRow
                      key={row.key}
                      name={row.name}
                      subtitle={`${row.massG}g · ${kcal} kcal`}
                      isChecked
                      onTap={() => setSelectedKey(row.key)}
                      onRemove={() => handleRemoveIngredient(row.key)}
                    />
                  )
                })}

                <button
                  type="button"
                  onClick={() => setShowPicker(true)}
                  className="flex w-full items-center gap-2 px-4 py-3 text-sm text-[var(--app-brand)] hover:bg-[var(--app-hover-overlay)] transition-colors"
                >
                  <svg className="h-4 w-4 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add ingredient
                </button>
              </div>

              {ingredients.length > 0 && (
                <div className="border-t border-[var(--app-border-muted)] px-4 pt-3 pb-4 space-y-2">
                  <p className="text-[10px] font-semibold tracking-widest uppercase text-[var(--app-text-subtle)]">
                    Nutrition preview
                  </p>
                  <div className="space-y-2">
                    <NutritionRow label={`Whole recipe (${rawMassSum}g raw)`} data={rollup.totals} fmt={fmt} />
                    {rollup.per100g && <NutritionRow label="Per 100 g" data={rollup.per100g} fmt={fmt} />}
                    {rollup.perPiece && pieceCount && pieceCount > 0 && (
                      <NutritionRow
                        label={`Per ${pieceLabel.trim() || 'piece'} (${fmt(totalMassG / pieceCount)}g)`}
                        data={rollup.perPiece}
                        fmt={fmt}
                      />
                    )}
                  </div>
                </div>
              )}

              {serverError && (
                <p className="px-4 pb-3 text-[var(--app-danger)] text-sm">{serverError}</p>
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
              const kcal = Math.round(row.caloriesPer100g * row.massG / 100)
              return (
                <>
                  <div className="flex-none flex items-center gap-3 px-4 py-3 border-b border-[var(--app-border-muted)]">
                    <button
                      type="button"
                      onClick={() => setSelectedKey(null)}
                      className="flex-none h-9 w-9 flex items-center justify-center rounded-full hover:bg-[var(--app-hover-overlay)] transition-colors text-[var(--app-text-muted)]"
                      aria-label="Back to ingredient list"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <p className="text-sm font-semibold text-[var(--app-text-primary)] truncate">{row.name}</p>
                  </div>
                  <div className="flex flex-1 flex-col items-center justify-center">
                    <KcalGramEditor
                      kcal={kcal}
                      grams={row.massG}
                      onGramsChange={(g) => handleMassChange(row.key, g)}
                    />
                  </div>
                </>
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
