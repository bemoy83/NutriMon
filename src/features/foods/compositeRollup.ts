export interface DraftIngredient {
  caloriesPer100g: number
  proteinPer100g: number | null
  carbsPer100g: number | null
  fatPer100g: number | null
  massG: number
}

export interface NutritionTotals {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export interface RollupResult {
  totals: NutritionTotals
  per100g: NutritionTotals | null
  perPiece: NutritionTotals | null
}

export function computeRollup(
  ingredients: DraftIngredient[],
  totalMassG: number,
  pieceCount: number | null,
): RollupResult {
  const totals = ingredients.reduce(
    (acc, ing) => ({
      calories: acc.calories + (ing.caloriesPer100g * ing.massG) / 100,
      protein: acc.protein + ((ing.proteinPer100g ?? 0) * ing.massG) / 100,
      carbs: acc.carbs + ((ing.carbsPer100g ?? 0) * ing.massG) / 100,
      fat: acc.fat + ((ing.fatPer100g ?? 0) * ing.massG) / 100,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )

  const per100g =
    totalMassG > 0
      ? {
          calories: (totals.calories / totalMassG) * 100,
          protein: (totals.protein / totalMassG) * 100,
          carbs: (totals.carbs / totalMassG) * 100,
          fat: (totals.fat / totalMassG) * 100,
        }
      : null

  const perPiece =
    per100g && pieceCount && pieceCount > 0
      ? {
          calories: (per100g.calories * (totalMassG / pieceCount)) / 100,
          protein: (per100g.protein * (totalMassG / pieceCount)) / 100,
          carbs: (per100g.carbs * (totalMassG / pieceCount)) / 100,
          fat: (per100g.fat * (totalMassG / pieceCount)) / 100,
        }
      : null

  return { totals, per100g, perPiece }
}
