import type { RefObject } from 'react'
import { MEAL_TYPES, getMealTypeTheme } from '@/lib/mealType'
import type { MealType } from '@/lib/mealType'

export interface MealTypeTitleMenuProps {
  mealMenuRef: RefObject<HTMLDivElement | null>
  mealMenuOpen: boolean
  onOpenChange: (open: boolean) => void
  mealType: MealType
  onMealTypeChange: (type: MealType) => void
  mealTheme: ReturnType<typeof getMealTypeTheme>
}

export default function MealTypeTitleMenu({
  mealMenuRef,
  mealMenuOpen,
  onOpenChange,
  mealType,
  onMealTypeChange,
  mealTheme,
}: MealTypeTitleMenuProps) {
  return (
    <div ref={mealMenuRef} className="relative">
      <button
        type="button"
        onClick={() => onOpenChange(!mealMenuOpen)}
        className="group inline-flex items-center gap-1.5 rounded-md py-1 pr-1 text-base font-semibold text-[var(--app-text-primary)] transition-[color,box-shadow] duration-[var(--app-transition-fast)] hover:text-[var(--app-text-secondary)] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--app-brand-ring),var(--app-input-shadow-focus)]"
        aria-haspopup="menu"
        aria-expanded={mealMenuOpen}
        aria-label={`Change meal type, currently ${mealType}`}
      >
        <span>
          Add to{' '}
          <span style={{ color: mealTheme?.text ?? 'var(--app-brand)' }}>
            {mealType}
          </span>
        </span>
        <svg
          className={`h-4 w-4 transition-transform duration-[var(--app-transition-fast)] ${mealMenuOpen ? 'rotate-180' : ''}`}
          style={{ color: mealTheme?.text ?? 'var(--app-brand)' }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {mealMenuOpen && (
        <div
          role="menu"
          className="absolute left-0 top-full z-30 mt-2 w-44 rounded-2xl border border-[var(--app-border-muted)] bg-white p-1.5 shadow-[0_12px_32px_rgb(15_23_42/0.16)]"
        >
          {MEAL_TYPES.map((type) => {
            const selected = mealType === type
            const theme = getMealTypeTheme(type)

            return (
              <button
                key={type}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => {
                  onMealTypeChange(type)
                  onOpenChange(false)
                }}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-[var(--app-input-bg)] focus-visible:bg-[var(--app-input-bg)] focus-visible:outline-none"
                style={{
                  color: selected
                    ? (theme?.text ?? 'var(--app-brand)')
                    : 'var(--app-text-secondary)',
                }}
              >
                <span>{type}</span>
                {selected && (
                  <svg className="h-4 w-4 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
