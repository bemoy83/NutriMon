import type { Meal } from '@/types/domain'
import type { DeleteMealResult, MealMutationResult } from '@/types/database'

export type DailyLogMealEditState =
  | {
      mealEditAction: {
        kind: 'saved'
        logDate: string
        result: MealMutationResult
      }
    }
  | {
      mealEditAction: {
        kind: 'deleted'
        logDate: string
        result: DeleteMealResult
        deletedMeal: Meal
      }
    }

