import { useState } from 'react'
import type { Meal, MealItem } from '@/types/domain'
import { formatTime } from '@/lib/date'
import { useInvalidateDailyLog } from './useDailyLog'
import { useInvalidateProducts } from './useProducts'
import { deleteMeal } from './api'

interface Props {
  meals: Meal[]
  isFinalized: boolean
  timezone: string
  logDate: string
  onEditMeal: (meal: Meal) => void
  onDeleteSuccess: (meal: Meal) => void
}

export default function MealList({ meals, isFinalized, timezone, logDate, onEditMeal, onDeleteSuccess }: Props) {
  const [expandedMealId, setExpandedMealId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const invalidateDailyLog = useInvalidateDailyLog()
  const invalidateProducts = useInvalidateProducts()

  async function handleDelete(meal: Meal) {
    setDeletingId(meal.id)
    try {
      await deleteMeal(meal.id)
      invalidateDailyLog(logDate)
      invalidateProducts()
      onDeleteSuccess(meal)
    } finally {
      setDeletingId(null)
    }
  }

  if (meals.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500 text-sm">No meals logged yet.</p>
        <p className="text-slate-600 text-xs mt-1">Tap + to add your first meal.</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-2">
        {meals.map((meal) => (
          <MealCard
            key={meal.id}
            meal={meal}
            isFinalized={isFinalized}
            timezone={timezone}
            expanded={expandedMealId === meal.id}
            deleting={deletingId === meal.id}
            onToggle={() =>
              setExpandedMealId((prev) => (prev === meal.id ? null : meal.id))
            }
            onEdit={() => onEditMeal(meal)}
            onDelete={() => handleDelete(meal)}
          />
        ))}
      </div>

    </>
  )
}

function MealCard({
  meal,
  isFinalized,
  timezone,
  expanded,
  deleting,
  onToggle,
  onEdit,
  onDelete,
}: {
  meal: Meal
  isFinalized: boolean
  timezone: string
  expanded: boolean
  deleting: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="bg-slate-800 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-750 transition-colors text-left"
      >
        <div>
          <p className="text-white text-sm font-medium">
            {formatTime(meal.loggedAt, timezone)}
          </p>
          <p className="text-slate-400 text-xs mt-0.5">
            {meal.itemCount} item{meal.itemCount !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-white font-semibold">{meal.totalCalories} kcal</span>
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-700">
          {/* Items */}
          <div className="px-4 py-2 space-y-1.5">
            {(meal.items ?? []).map((item) => (
              <MealItemRow key={item.id} item={item} />
            ))}
          </div>

          {/* Actions */}
          {!isFinalized && (
            <div className="flex border-t border-slate-700">
              <button
                onClick={onEdit}
                className="flex-1 py-2.5 text-sm text-indigo-400 hover:bg-slate-750 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={onDelete}
                disabled={deleting}
                className="flex-1 py-2.5 text-sm text-red-400 hover:bg-slate-750 transition-colors disabled:opacity-40"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MealItemRow({ item }: { item: MealItem }) {
  const servingLabel =
    item.servingAmountSnapshot && item.servingUnitSnapshot
      ? `${item.quantity * item.servingAmountSnapshot}${item.servingUnitSnapshot}`
      : `×${item.quantity}`

  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="text-slate-200 text-sm">{item.productNameSnapshot}</span>
        <span className="text-slate-500 text-xs ml-2">{servingLabel}</span>
      </div>
      <span className="text-slate-300 text-sm">{item.lineTotalCalories} kcal</span>
    </div>
  )
}
