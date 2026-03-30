import { useState } from 'react'
import { repeatLastMeal } from './api'
import type { MealMutationResult } from '@/types/database'

interface UseRepeatLastMealActionOptions {
  logDate: string
  onSuccess: (result: MealMutationResult) => void
}

export function useRepeatLastMealAction({ logDate, onSuccess }: UseRepeatLastMealActionOptions) {
  const [repeating, setRepeating] = useState(false)
  const [repeatError, setRepeatError] = useState<string | null>(null)

  async function handleRepeatLastMeal() {
    setRepeating(true)
    setRepeatError(null)

    try {
      const result = await repeatLastMeal(logDate)
      onSuccess(result)
    } catch (error) {
      setRepeatError(error instanceof Error ? error.message : 'Unable to repeat last meal')
    } finally {
      setRepeating(false)
    }
  }

  return {
    repeating,
    repeatError,
    handleRepeatLastMeal,
  }
}
