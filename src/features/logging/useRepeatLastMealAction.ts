import { useState } from 'react'
import { repeatLastMealOfType } from './api'
import { useAuth } from '@/app/providers/auth'
import type { MealMutationResult } from '@/types/database'

interface UseRepeatLastMealActionOptions {
  logDate: string
  mealType: string
  onSuccess: (result: MealMutationResult) => void
}

export function useRepeatLastMealAction({ logDate, mealType, onSuccess }: UseRepeatLastMealActionOptions) {
  const { user } = useAuth()
  const [repeating, setRepeating] = useState(false)
  const [repeatError, setRepeatError] = useState<string | null>(null)

  async function handleRepeatLastMeal() {
    if (!user) return
    setRepeating(true)
    setRepeatError(null)

    try {
      const result = await repeatLastMealOfType(user.id, logDate, new Date().toISOString(), mealType)
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
