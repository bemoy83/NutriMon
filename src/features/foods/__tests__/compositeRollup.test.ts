import { describe, expect, it } from 'vitest'
import { computeRollup } from '../compositeRollup'

describe('computeRollup', () => {
  // AC1: Create composite "Spaghetti" with 3 ingredients, total 400g, 4 pieces
  it('computes correct rollup for Spaghetti (AC1)', () => {
    const ingredients = [
      { caloriesPer100g: 131, proteinPer100g: 5, carbsPer100g: 25, fatPer100g: 1.1, massG: 200 }, // pasta
      { caloriesPer100g: 50, proteinPer100g: 2, carbsPer100g: 8, fatPer100g: 1.5, massG: 150 },   // sauce
      { caloriesPer100g: 250, proteinPer100g: 18, carbsPer100g: 0, fatPer100g: 20, massG: 50 },    // cheese
    ]

    const result = computeRollup(ingredients, 400, 4)

    // Total ingredient calories: (131*200/100) + (50*150/100) + (250*50/100) = 262 + 75 + 125 = 462
    expect(result.totals.calories).toBeCloseTo(462, 1)

    // Per 100g: 462 / 400 * 100 = 115.5
    expect(result.per100g).not.toBeNull()
    expect(result.per100g!.calories).toBeCloseTo(115.5, 1)

    // Per piece (4 pieces from 400g = 100g each): 115.5 * 100 / 100 = 115.5
    expect(result.perPiece).not.toBeNull()
    expect(result.perPiece!.calories).toBeCloseTo(115.5, 1)

    // Piece math = total ÷ 4
    expect(result.perPiece!.calories * 4).toBeCloseTo(result.totals.calories, 0)
  })

  it('returns null per100g when totalMassG is 0', () => {
    const ingredients = [
      { caloriesPer100g: 100, proteinPer100g: 10, carbsPer100g: 20, fatPer100g: 5, massG: 100 },
    ]
    const result = computeRollup(ingredients, 0, null)
    expect(result.per100g).toBeNull()
    expect(result.perPiece).toBeNull()
  })

  it('returns null perPiece when pieceCount is null', () => {
    const ingredients = [
      { caloriesPer100g: 100, proteinPer100g: 10, carbsPer100g: 20, fatPer100g: 5, massG: 200 },
    ]
    const result = computeRollup(ingredients, 200, null)
    expect(result.per100g).not.toBeNull()
    expect(result.perPiece).toBeNull()
  })

  it('handles nullable macro fields', () => {
    const ingredients = [
      { caloriesPer100g: 100, proteinPer100g: null, carbsPer100g: null, fatPer100g: null, massG: 100 },
    ]
    const result = computeRollup(ingredients, 100, null)
    expect(result.totals.calories).toBe(100)
    expect(result.totals.protein).toBe(0)
    expect(result.totals.carbs).toBe(0)
    expect(result.totals.fat).toBe(0)
  })
})
