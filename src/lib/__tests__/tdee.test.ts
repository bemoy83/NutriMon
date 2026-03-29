import { describe, it, expect } from 'vitest'
import { calculateBMR, calculateTDEE, suggestCalorieTarget, lbToKg, kgToLb } from '../tdee'

describe('calculateBMR', () => {
  it('calculates male BMR correctly', () => {
    // 10*80 + 6.25*175 - 5*30 + 5 = 800 + 1093.75 - 150 + 5 = 1748.75
    expect(calculateBMR('male', 80, 175, 30)).toBeCloseTo(1748.75, 1)
  })

  it('calculates female BMR correctly', () => {
    // 10*65 + 6.25*165 - 5*25 - 161 = 650 + 1031.25 - 125 - 161 = 1395.25
    expect(calculateBMR('female', 65, 165, 25)).toBeCloseTo(1395.25, 1)
  })
})

describe('calculateTDEE', () => {
  it('applies sedentary multiplier', () => {
    expect(calculateTDEE(1748.75, 'sedentary')).toBeCloseTo(1748.75 * 1.2, 1)
  })

  it('applies lightly_active multiplier', () => {
    expect(calculateTDEE(1748.75, 'lightly_active')).toBeCloseTo(1748.75 * 1.375, 1)
  })

  it('applies moderately_active multiplier', () => {
    expect(calculateTDEE(1748.75, 'moderately_active')).toBeCloseTo(1748.75 * 1.55, 1)
  })

  it('applies very_active multiplier', () => {
    expect(calculateTDEE(1748.75, 'very_active')).toBeCloseTo(1748.75 * 1.725, 1)
  })
})

describe('suggestCalorieTarget', () => {
  it('subtracts 500 from TDEE and rounds', () => {
    expect(suggestCalorieTarget(2500)).toBe(2000)
  })

  it('clamps to minimum 1200', () => {
    expect(suggestCalorieTarget(1500)).toBe(1200)
  })

  it('clamps to maximum 4000', () => {
    expect(suggestCalorieTarget(5000)).toBe(4000)
  })
})

describe('unit conversions', () => {
  it('converts lb to kg', () => {
    expect(lbToKg(154)).toBeCloseTo(69.85, 1)
  })

  it('converts kg to lb', () => {
    expect(kgToLb(70)).toBeCloseTo(154.32, 1)
  })
})
