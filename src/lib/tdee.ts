import type { SexForTDEE, ActivityLevel } from '@/types/domain'
import { ACTIVITY_MULTIPLIERS, TDEE_DEFICIT, SUGGESTED_TARGET_MIN, SUGGESTED_TARGET_MAX } from '@/lib/constants'

export function calculateBMR(
  sex: SexForTDEE,
  weightKg: number,
  heightCm: number,
  ageYears: number,
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears
  return sex === 'male' ? base + 5 : base - 161
}

export function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
  return bmr * ACTIVITY_MULTIPLIERS[activityLevel]
}

export function suggestCalorieTarget(tdee: number): number {
  const suggestion = Math.round(tdee - TDEE_DEFICIT)
  return Math.min(Math.max(suggestion, SUGGESTED_TARGET_MIN), SUGGESTED_TARGET_MAX)
}

export function calculateTDEEFromProfile(
  sex: SexForTDEE,
  weightKg: number,
  heightCm: number,
  ageYears: number,
  activityLevel: ActivityLevel,
): number {
  return calculateTDEE(calculateBMR(sex, weightKg, heightCm, ageYears), activityLevel)
}

export function lbToKg(lb: number): number {
  return lb / 2.20462
}

export function kgToLb(kg: number): number {
  return kg * 2.20462
}

export function inchesToCm(inches: number): number {
  return inches * 2.54
}

export function cmToInches(cm: number): number {
  return cm / 2.54
}
