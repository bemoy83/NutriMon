import type { MealItem } from '@/types/domain'
import { formatMealItemServingLabel } from '../itemHelpers'

export function LoggedMealItemRow({ item, onClick }: { item: MealItem; onClick?: () => void }) {
  const servingLabel = formatMealItemServingLabel(item)
  const p = Math.round((item.proteinGSnapshot ?? 0) * item.quantity)
  const c = Math.round((item.carbsGSnapshot ?? 0) * item.quantity)
  const f = Math.round((item.fatGSnapshot ?? 0) * item.quantity)

  const inner = (
    <div className="flex items-start justify-between gap-3 py-2.5 px-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate" style={{ color: 'var(--app-text-primary)' }}>
          {item.productNameSnapshot}
        </p>
        <div className="flex flex-wrap items-center gap-1 mt-0.5">
          <span className="text-xs" style={{ color: 'var(--app-text-muted)' }}>{servingLabel}</span>
          <span className="text-[10px]" style={{ color: 'var(--app-text-subtle)' }}>·</span>
          <span className="text-[10px] font-bold rounded px-1 py-px tabular-nums" style={{ color: 'var(--app-macro-protein)', background: 'var(--app-macro-protein-bg)' }}>P {p}g</span>
          <span className="text-[10px] font-bold rounded px-1 py-px tabular-nums" style={{ color: 'var(--app-macro-carbs)', background: 'var(--app-macro-carbs-bg)' }}>C {c}g</span>
          <span className="text-[10px] font-bold rounded px-1 py-px tabular-nums" style={{ color: 'var(--app-macro-fat)', background: 'var(--app-macro-fat-bg)' }}>F {f}g</span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0 pt-0.5">
        <div className="text-right">
          <span className="text-sm tabular-nums" style={{ color: 'var(--app-text-primary)' }}>
            {item.lineTotalCalories}
          </span>
          <span className="text-xs ml-0.5" style={{ color: 'var(--app-text-muted)' }}>kcal</span>
        </div>
        {onClick && (
          <svg width={12} height={12} viewBox="0 0 12 12" fill="none" aria-hidden style={{ opacity: 0.3, flexShrink: 0 }}>
            <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </div>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left transition-colors hover:bg-[var(--app-hover-overlay)] active:bg-[var(--app-surface-muted)]"
        aria-label={`Adjust serving for ${item.productNameSnapshot}`}
      >
        {inner}
      </button>
    )
  }

  return <div>{inner}</div>
}
