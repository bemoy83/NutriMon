import type { FoodSource } from '@/types/domain'
import { getItemCalories, getItemLabel, getItemSourceType } from './itemHelpers'
import type { Item } from './types'
import type { ServingStepTarget } from './ServingStep'

export interface FoodSourceDraftInit {
  pendingGrams: number
  pendingPortions: number
  massInputMode: 'grams' | 'portions'
  pendingMode: 'grams' | 'pieces'
}

export interface ServingConfirmPayload {
  quantity: number
  compositeQuantityMode?: 'grams' | 'pieces'
}

export interface ServingNutritionEstimate {
  kcal: number
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
}

type ServingDraft = {
  pendingMode: 'grams' | 'pieces'
  massInputMode: 'grams' | 'portions'
  pendingGrams: number
  pendingPortions: number
}

/**
 * True when the food supports switching between mass (g) and piece count for a composite.
 */
export function isCompositeWithPiecesForFood(food: FoodSource | null | undefined): boolean {
  if (!food) return false
  return food.kind === 'composite' && (food.pieceCount ?? 0) > 0 && (food.totalMassG ?? 0) > 0
}

/**
 * For MealSheet / FoodSource flow: same-day serving draft initialization when opening a food.
 */
export function initFoodSourceServingDraft(food: FoodSource, existing?: Item): FoodSourceDraftInit {
  if (existing?.compositeQuantityMode === 'pieces') {
    return {
      massInputMode: 'grams',
      pendingMode: 'pieces',
      pendingGrams: existing.quantity,
      pendingPortions: 1,
    }
  }
  const currentGrams = existing
    ? Math.round(existing.quantity * 100)
    : (food.labelPortionGrams ?? 100)
  const pendingPortions =
    food.labelPortionGrams && food.labelPortionGrams > 0
      ? Math.max(1, Math.round(currentGrams / food.labelPortionGrams))
      : 1
  return {
    massInputMode: 'grams',
    pendingMode: 'grams',
    pendingGrams: currentGrams,
    pendingPortions,
  }
}

/**
 * For ServingEditSheet: initial draft state from a logged or pending `Item`.
 */
export function initItemServingDraft(item: Item): FoodSourceDraftInit {
  const labelGrams = item.foodSource?.labelPortionGrams ?? item.snapshotLabelPortionGrams
  const currentGrams = item.compositeQuantityMode === 'pieces'
    ? item.quantity
    : Math.round(item.quantity * 100)
  return {
    pendingGrams: currentGrams,
    pendingMode: item.compositeQuantityMode === 'pieces' ? 'pieces' : 'grams',
    massInputMode: 'grams',
    pendingPortions:
      labelGrams && labelGrams > 0
        ? Math.max(1, Math.round(currentGrams / labelGrams))
        : 1,
  }
}

export function servingStepTargetFromFood(food: FoodSource): ServingStepTarget {
  return {
    name: food.name,
    sourceType: food.sourceType,
    defaultServingAmount: food.defaultServingAmount,
    defaultServingUnit: food.defaultServingUnit,
    labelPortionGrams: food.labelPortionGrams,
    pieceCount: food.pieceCount,
    pieceLabel: food.pieceLabel,
    totalMassG: food.totalMassG,
  }
}

/**
 * `ServingEditSheet` can open for snapshot-only items (e.g. deleted product).
 */
export function servingStepTargetFromItem(item: Item): ServingStepTarget {
  if (item.foodSource) {
    return servingStepTargetFromFood(item.foodSource)
  }
  return {
    name: getItemLabel(item),
    sourceType: getItemSourceType(item) ?? undefined,
    defaultServingAmount: item.snapshotServingAmount ?? null,
    defaultServingUnit: item.snapshotServingUnit ?? null,
    labelPortionGrams: item.snapshotLabelPortionGrams ?? null,
    pieceCount: null,
    pieceLabel:
      item.snapshotServingUnit && item.snapshotServingUnit !== 'g'
        ? item.snapshotServingUnit
        : null,
    totalMassG: null,
  }
}

/**
 * When switching grams ⟷ saved serving sizes, keep the displayed mass consistent.
 * Used by MealSheet and ServingEditSheet.
 */
export function applyMassInputModeForLabel(
  labelGrams: number | null | undefined,
  mode: 'grams' | 'portions',
  pendingGrams: number,
  pendingPortions: number,
): { pendingGrams: number; pendingPortions: number } {
  if (mode === 'portions' && labelGrams && labelGrams > 0) {
    return { pendingGrams, pendingPortions: Math.max(1, Math.round(pendingGrams / labelGrams)) }
  }
  if (mode === 'grams' && labelGrams && labelGrams > 0) {
    return { pendingGrams: Math.round(pendingPortions * labelGrams), pendingPortions }
  }
  return { pendingGrams, pendingPortions }
}

function gramsEquivalentForFood(
  food: FoodSource,
  massInputMode: 'grams' | 'portions',
  pendingGrams: number,
  pendingPortions: number,
): number {
  if (
    massInputMode === 'portions'
    && food.labelPortionGrams
    && food.labelPortionGrams > 0
  ) {
    return pendingPortions * food.labelPortionGrams
  }
  return pendingGrams
}

function scaleMacro(valuePer100g: number | null | undefined, gramsEq: number): number | null {
  if (valuePer100g == null) return null
  return valuePer100g * (gramsEq / 100)
}

/**
 * Live kcal while editing with a `FoodSource` (MealSheet serving step and ServingEditSheet when `item.foodSource` exists).
 */
export function computeLiveEstimateFoodSource(food: FoodSource, draft: ServingDraft): ServingNutritionEstimate {
  const densityPer100 = food.caloriesPer100g ?? food.calories
  const isCompPieces = isCompositeWithPiecesForFood(food)
  let gramsEq: number

  if (draft.pendingMode === 'pieces' && isCompPieces) {
    const gramsPerPiece = food.totalMassG! / food.pieceCount!
    gramsEq = draft.pendingGrams * gramsPerPiece
  } else {
    gramsEq = gramsEquivalentForFood(food, draft.massInputMode, draft.pendingGrams, draft.pendingPortions)
  }

  return {
    kcal: Math.round(gramsEq * (densityPer100 / 100)),
    proteinG: scaleMacro(food.proteinG, gramsEq),
    carbsG: scaleMacro(food.carbsG, gramsEq),
    fatG: scaleMacro(food.fatG, gramsEq),
  }
}

export function computeLiveKcalFoodSource(food: FoodSource, draft: ServingDraft): number {
  return computeLiveEstimateFoodSource(food, draft).kcal
}

/**
 * Unified live kcal for `ServingEditSheet`.
 * `initItemsFromMeal` does not attach `foodSource`, so most edit rows use snapshot fields — when the stepper
 * is in **portions** mode, kcal must follow `pendingPortions × label grams`, not the stale `pendingGrams` slice.
 */
export function computeLiveEstimateItemEdit(item: Item, draft: ServingDraft): ServingNutritionEstimate {
  if (item.foodSource) {
    return computeLiveEstimateFoodSource(item.foodSource, draft)
  }
  if (item.compositeQuantityMode === 'pieces') {
    return {
      kcal: Math.round(draft.pendingGrams * getItemCalories(item)),
      proteinG: item.snapshotProteinG == null ? null : draft.pendingGrams * item.snapshotProteinG,
      carbsG: item.snapshotCarbsG == null ? null : draft.pendingGrams * item.snapshotCarbsG,
      fatG: item.snapshotFatG == null ? null : draft.pendingGrams * item.snapshotFatG,
    }
  }
  const label = item.snapshotLabelPortionGrams
  let quantity: number
  if (draft.massInputMode === 'portions' && label && label > 0) {
    const gramsEq = draft.pendingPortions * label
    quantity = gramsEq / 100
  } else {
    quantity = draft.pendingGrams / 100
  }
  return {
    kcal: Math.round(quantity * getItemCalories(item)),
    proteinG: item.snapshotProteinG == null ? null : quantity * item.snapshotProteinG,
    carbsG: item.snapshotCarbsG == null ? null : quantity * item.snapshotCarbsG,
    fatG: item.snapshotFatG == null ? null : quantity * item.snapshotFatG,
  }
}

export function computeLiveKcalItemEdit(item: Item, draft: ServingDraft): number {
  return computeLiveEstimateItemEdit(item, draft).kcal
}

export function isConfirmDisabledForFood(
  food: FoodSource,
  draft: {
    pendingMode: 'grams' | 'pieces'
    massInputMode: 'grams' | 'portions'
    pendingGrams: number
    pendingPortions: number
  },
): boolean {
  const isComp = isCompositeWithPiecesForFood(food)
  if (draft.pendingMode === 'pieces' && isComp) {
    return draft.pendingGrams <= 0
  }
  if (
    draft.massInputMode === 'portions'
    && food.labelPortionGrams
    && food.labelPortionGrams > 0
  ) {
    return draft.pendingPortions <= 0
  }
  return draft.pendingGrams <= 0
}

/**
 * `ServingEditSheet` uses snapshot label grams when `foodSource` is missing.
 */
export function isConfirmDisabledItemEdit(
  item: Item,
  target: ServingStepTarget,
  draft: {
    pendingMode: 'grams' | 'pieces'
    massInputMode: 'grams' | 'portions'
    pendingGrams: number
    pendingPortions: number
  },
): boolean {
  if (item.foodSource) {
    return isConfirmDisabledForFood(item.foodSource, draft)
  }
  if (draft.pendingMode === 'pieces' && (item.compositeQuantityMode === 'pieces')) {
    return draft.pendingGrams <= 0
  }
  if (
    draft.massInputMode === 'portions'
    && target.labelPortionGrams
    && target.labelPortionGrams > 0
  ) {
    return draft.pendingPortions <= 0
  }
  return draft.pendingGrams <= 0
}

export function buildConfirmPayloadFromFood(
  food: FoodSource,
  draft: {
    pendingMode: 'grams' | 'pieces'
    massInputMode: 'grams' | 'portions'
    pendingGrams: number
    pendingPortions: number
  },
): ServingConfirmPayload | null {
  const isComp = isCompositeWithPiecesForFood(food)
  if (draft.pendingMode === 'pieces' && isComp) {
    if (draft.pendingGrams <= 0) return null
    return { quantity: draft.pendingGrams, compositeQuantityMode: 'pieces' }
  }
  const gramsEq = gramsEquivalentForFood(food, draft.massInputMode, draft.pendingGrams, draft.pendingPortions)
  if (gramsEq <= 0) return null
  return {
    quantity: gramsEq / 100,
    compositeQuantityMode: food.kind === 'composite' ? 'grams' : undefined,
  }
}

/**
 * `ServingEditSheet` submit mapping: snapshot-only non–piece rows use `pendingGrams / 100` (original behavior),
 * not label-portion grams, even if the stepper is in "portions" mode.
 */
export function buildConfirmPayloadItemEdit(
  item: Item,
  draft: {
    pendingMode: 'grams' | 'pieces'
    massInputMode: 'grams' | 'portions'
    pendingGrams: number
    pendingPortions: number
  },
): ServingConfirmPayload | null {
  if (item.foodSource) {
    return buildConfirmPayloadFromFood(item.foodSource, draft)
  }
  if (item.compositeQuantityMode === 'pieces') {
    if (draft.pendingGrams <= 0) return null
    return { quantity: draft.pendingGrams, compositeQuantityMode: 'pieces' }
  }
  if (draft.pendingGrams <= 0) return null
  return { quantity: draft.pendingGrams / 100, compositeQuantityMode: item.compositeQuantityMode }
}
