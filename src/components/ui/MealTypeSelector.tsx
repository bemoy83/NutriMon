import { MEAL_TYPES } from '@/lib/mealType'
import type { MealType } from '@/lib/mealType'

interface Props {
  value: MealType
  onChange: (v: MealType) => void
}

export default function MealTypeSelector({ value, onChange }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-3 border-b border-[var(--app-border)] scrollbar-hide">
      {MEAL_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          onClick={() => onChange(type)}
          className={`flex-none px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
            value === type
              ? 'bg-[var(--app-brand)] text-white'
              : 'border border-[var(--app-border)] text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:border-[var(--app-brand)]'
          }`}
        >
          {type}
        </button>
      ))}
    </div>
  )
}
