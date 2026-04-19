import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import BottomSheet from '@/components/ui/BottomSheet'
import GramInput from '@/components/ui/GramInput'
import LoadingState from '@/components/ui/LoadingState'
import { getCompositeProduct, upsertCompositeProduct, deleteProduct } from '@/features/foods/api'
import { computeRollup } from '@/features/foods/compositeRollup'
import { useInvalidateProductQueries } from '@/features/logging/queryInvalidation'
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

interface CompositeFoodSheetProps {
  editProductId?: string | null
  onClose: () => void
  onSaved: () => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n < 10 ? n.toFixed(1) : Math.round(n).toString()
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CompositeFoodSheet({
  editProductId,
  onClose,
  onSaved,
}: CompositeFoodSheetProps) {
  const isEditMode = editProductId != null
  const invalidateProducts = useInvalidateProductQueries()

  const [name, setName] = useState('')
  const [totalMassG, setTotalMassG] = useState(0)
  const [pieceCount, setPieceCount] = useState<number | null>(null)
  const [pieceLabel, setPieceLabel] = useState('')
  const [ingredients, setIngredients] = useState<DraftIngredientRow[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
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

  // ─── Ingredient actions ───────────────────────────────────────────────────

  function handleAddIngredient(row: DraftIngredientRow) {
    setIngredients((prev) => [...prev, row])
    setShowPicker(false)
  }

  function handleRemoveIngredient(key: string) {
    setIngredients((prev) => prev.filter((r) => r.key !== key))
  }

  function handleMassChange(key: string, massG: number) {
    setIngredients((prev) =>
      prev.map((r) => (r.key === key ? { ...r, massG } : r)),
    )
  }

  function handleSwap(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= ingredients.length) return
    setIngredients((prev) => {
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async function handleDeleteRecipe() {
    if (!editProductId) return
    if (!window.confirm(`Delete "${name}"? Logged meals will keep their historical snapshots.`)) return

    setIsDeleting(true)
    try {
      await deleteProduct(editProductId)
      invalidateProducts()
      onClose()
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Failed to delete recipe')
    } finally {
      setIsDeleting(false)
    }
  }

  // ─── Save ─────────────────────────────────────────────────────────────────

  const canSave =
    name.trim().length > 0 && totalMassG > 0 && ingredients.length > 0

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
      onClose()
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  // ─── Piece count helpers ──────────────────────────────────────────────────

  function handlePieceCountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    if (raw === '') {
      setPieceCount(null)
      return
    }
    const parsed = parseInt(raw, 10)
    if (!isNaN(parsed) && parsed >= 0) setPieceCount(parsed || null)
  }

  // ─── Exclude already-added product IDs from picker ────────────────────────

  const excludeProductIds = ingredients
    .filter((r) => r.sourceType === 'product')
    .map((r) => r.sourceId)

  // ─── Loading state for edit mode ──────────────────────────────────────────

  if (isEditMode && !initialized) {
    return (
      <BottomSheet onClose={onClose} title="Edit recipe">
        <LoadingState />
      </BottomSheet>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const rawMassSum = ingredients.reduce((sum, r) => sum + r.massG, 0)

  return (
    <>
      <BottomSheet
        onClose={onClose}
        title={isEditMode ? 'Edit recipe' : 'New recipe'}
        className="max-h-[92vh]"
        footer={
          <div className="space-y-2">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="app-button-secondary flex-1 py-2.5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canSave || saving}
                onClick={handleSave}
                className="app-button-primary flex-1 py-2.5"
              >
                {saving ? 'Saving\u2026' : isEditMode ? 'Save changes' : 'Save'}
              </button>
            </div>
            {isEditMode && (
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteRecipe}
                className="app-button-danger w-full py-2.5 text-sm"
              >
                {isDeleting ? 'Deleting\u2026' : 'Delete recipe'}
              </button>
            )}
          </div>
        }
      >
        <div className="overflow-y-auto p-4 space-y-4">
          {/* Name */}
          <div>
            <label htmlFor="comp-name" className="block text-sm text-slate-300 mb-1">
              Recipe name <span className="text-red-400">*</span>
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

          {/* Total prepared weight */}
          <div>
            <label htmlFor="comp-mass" className="block text-sm text-slate-300 mb-1">
              Total weight after cooking (g) <span className="text-red-400">*</span>
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
              className="app-input px-3 py-2"
              placeholder="800"
            />
          </div>

          {/* Piece count + label */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="comp-pieces" className="block text-xs text-slate-400 mb-1">
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
            {pieceCount != null && pieceCount > 0 && (
              <div>
                <label htmlFor="comp-piece-label" className="block text-xs text-slate-400 mb-1">
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

          {/* Ingredients */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-[var(--app-text-primary)]">
                Ingredients <span className="text-red-400">*</span>
              </p>
              <button
                type="button"
                onClick={() => setShowPicker(true)}
                className="app-button-primary px-2.5 py-1 text-xs"
              >
                Add
              </button>
            </div>

            {ingredients.length === 0 ? (
              <p className="text-xs text-[var(--app-text-muted)] py-3 text-center">
                No ingredients added yet.
              </p>
            ) : (
              <div className="space-y-1.5">
                {ingredients.map((row, idx) => (
                  <div
                    key={row.key}
                    className="flex items-center gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2.5 py-2"
                  >
                    {/* Reorder buttons */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleSwap(idx, -1)}
                        className="text-[10px] leading-none text-[var(--app-text-muted)] disabled:opacity-30"
                        aria-label="Move up"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        disabled={idx === ingredients.length - 1}
                        onClick={() => handleSwap(idx, 1)}
                        className="text-[10px] leading-none text-[var(--app-text-muted)] disabled:opacity-30"
                        aria-label="Move down"
                      >
                        ▼
                      </button>
                    </div>

                    {/* Name */}
                    <p className="min-w-0 flex-1 truncate text-sm text-[var(--app-text-primary)]">
                      {row.name}
                    </p>

                    {/* Mass */}
                    <GramInput
                      grams={row.massG}
                      onChange={(g) => handleMassChange(row.key, g)}
                      showSteppers={false}
                    />

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => handleRemoveIngredient(row.key)}
                      className="rounded p-1 text-[var(--app-text-muted)] transition-colors hover:text-[var(--app-danger)]"
                      aria-label={`Remove ${row.name}`}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Rollup preview */}
          {ingredients.length > 0 && (
            <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-3 space-y-2">
              <p className="text-xs font-medium text-[var(--app-text-muted)] uppercase tracking-wide">
                Nutrition preview
              </p>

              {/* Whole recipe */}
              <div>
                <p className="text-xs text-[var(--app-text-muted)] mb-0.5">Whole recipe ({rawMassSum}g raw)</p>
                <p className="text-sm text-[var(--app-text-primary)]">
                  {fmt(rollup.totals.calories)} kcal
                  <span className="text-[var(--app-text-muted)]">
                    {' '}&middot; P {fmt(rollup.totals.protein)}g
                    {' '}&middot; C {fmt(rollup.totals.carbs)}g
                    {' '}&middot; F {fmt(rollup.totals.fat)}g
                  </span>
                </p>
              </div>

              {/* Per 100g */}
              {rollup.per100g && (
                <div>
                  <p className="text-xs text-[var(--app-text-muted)] mb-0.5">Per 100 g</p>
                  <p className="text-sm text-[var(--app-text-primary)]">
                    {fmt(rollup.per100g.calories)} kcal
                    <span className="text-[var(--app-text-muted)]">
                      {' '}&middot; P {fmt(rollup.per100g.protein)}g
                      {' '}&middot; C {fmt(rollup.per100g.carbs)}g
                      {' '}&middot; F {fmt(rollup.per100g.fat)}g
                    </span>
                  </p>
                </div>
              )}

              {/* Per piece */}
              {rollup.perPiece && pieceCount && pieceCount > 0 && (
                <div>
                  <p className="text-xs text-[var(--app-text-muted)] mb-0.5">
                    Per {pieceLabel.trim() || 'piece'} ({fmt(totalMassG / pieceCount)}g)
                  </p>
                  <p className="text-sm text-[var(--app-text-primary)]">
                    {fmt(rollup.perPiece.calories)} kcal
                    <span className="text-[var(--app-text-muted)]">
                      {' '}&middot; P {fmt(rollup.perPiece.protein)}g
                      {' '}&middot; C {fmt(rollup.perPiece.carbs)}g
                      {' '}&middot; F {fmt(rollup.perPiece.fat)}g
                    </span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Server error */}
          {serverError && (
            <p className="text-[var(--app-danger)] text-sm">{serverError}</p>
          )}
        </div>
      </BottomSheet>

      {/* Ingredient picker overlay */}
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
