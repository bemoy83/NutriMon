import type { Meal } from '@/types/domain'
import { type MealType } from '@/lib/mealType'
import type { DeleteMealResult, MealMutationResult } from '@/types/database'
import { SLOTS } from './meal-slots/constants'
import { SlotCard } from './meal-slots/SlotCard'

interface Props {
  meals: Meal[]
  isFinalized: boolean
  timezone: string
  logDate: string
  onAddToSlot: (type: MealType) => void
  onUpdateSuccess: (result: MealMutationResult) => void
  onDeleteSuccess: (meal: Meal, result: DeleteMealResult) => void
}

export default function MealSlots({
  meals, isFinalized, timezone, logDate, onAddToSlot, onUpdateSuccess, onDeleteSuccess,
}: Props) {
  return (
    <div className="space-y-2">
      {SLOTS.map(slot => {
        const slotMeals = meals.filter(m => m.mealType === slot.type)
        return (
          <SlotCard
            key={slot.type}
            slot={slot}
            meals={slotMeals}
            isFinalized={isFinalized}
            timezone={timezone}
            logDate={logDate}
            onAdd={() => onAddToSlot(slot.type)}
            onUpdateSuccess={onUpdateSuccess}
            onDeleteSuccess={onDeleteSuccess}
          />
        )
      })}
    </div>
  )
}
