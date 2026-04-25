import type { MealTemplate } from '@/types/domain'

export function MealTemplateRow({
  template,
  loading,
  onLog,
  onDelete,
}: {
  template: MealTemplate
  loading: boolean
  onLog: () => void
  onDelete: () => void
}) {
  const estimatedCalories = template.items.reduce(
    (sum, i) => sum + Math.round(i.quantity * i.caloriesSnapshot),
    0,
  )
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--app-border-muted)] hover:bg-[var(--app-hover-overlay)] active:bg-[var(--app-hover-overlay)] transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-[var(--app-text-primary)] text-sm font-medium truncate">{template.name}</p>
        <p className="text-[var(--app-text-muted)] text-xs">
          {template.items.length} item{template.items.length !== 1 ? 's' : ''} · ~{estimatedCalories} kcal
          {template.defaultMealType && <span className="ml-1">· {template.defaultMealType}</span>}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onDelete}
          className="text-[var(--app-text-subtle)] hover:text-[var(--app-danger)] transition-colors text-xs px-1.5 py-1"
          aria-label="Delete template"
        >
          ✕
        </button>
        <button
          type="button"
          onClick={onLog}
          disabled={loading}
          className="app-button-primary px-3 py-1.5 text-xs disabled:opacity-50"
        >
          Log
        </button>
      </div>
    </div>
  )
}
