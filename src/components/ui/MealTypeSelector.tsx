import { MEAL_TYPES, getMealTypeTheme } from '@/lib/mealType'
import type { MealType } from '@/lib/mealType'

interface Props {
  value: MealType
  onChange: (v: MealType) => void
}

export default function MealTypeSelector({ value, onChange }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide">
      {MEAL_TYPES.map((type) => {
        const isActive = value === type
        const theme = getMealTypeTheme(type)
        const activeStyle = theme
          ? { background: theme.pillActiveBg, color: theme.pillActiveText, borderColor: 'transparent' }
          : { background: 'var(--app-brand)', color: 'white', borderColor: 'transparent' }

        return (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            className="flex-none px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap border"
            style={
              isActive
                ? activeStyle
                : { borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }
            }
          >
            {type}
          </button>
        )
      })}
    </div>
  )
}
