import type { RepeatLastMealPreview } from './useRepeatLastMealPreview'

function formatRepeatMealPreviewLine(p: RepeatLastMealPreview): string {
  const name = p.mealName?.trim() || null
  const rawType = p.mealType?.trim()
  const typePart =
    rawType && rawType.length > 0
      ? rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase()
      : null
  const calPart = `${Math.round(p.totalCalories)} kcal`

  if (name && typePart) return `${name} · ${typePart} · ${calPart}`
  if (name) return `${name} · ${calPart}`
  if (typePart) return `${typePart} · ${calPart}`
  return calPart
}

interface DailyLogRepeatCtaProps {
  preview: RepeatLastMealPreview
  repeating: boolean
  repeatError: string | null
  onRepeat: () => void
  className?: string
}

export default function DailyLogRepeatCta({
  preview,
  repeating,
  repeatError,
  onRepeat,
  className = '',
}: DailyLogRepeatCtaProps) {
  const previewLine = formatRepeatMealPreviewLine(preview)

  return (
    <div className={`flex flex-col ${className}`}>
      {repeatError ? (
        <p className="mb-1 text-center text-xs text-[var(--app-danger)]">{repeatError}</p>
      ) : null}
      <button
        type="button"
        onClick={onRepeat}
        disabled={repeating}
        aria-label={`Copy previous logged meal into today: ${previewLine}`}
        className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full border border-[var(--app-border)] bg-[rgb(255_255_255/0.72)] backdrop-blur-sm px-2 py-2.5 text-[var(--app-text-primary)] shadow-[0_4px_16px_rgb(15_23_42/0.10)] transition-colors hover:bg-[rgb(255_255_255/0.88)] disabled:opacity-50"
      >
        <span className="text-sm font-medium">
          {repeating ? 'Copying…' : `Copy last ${preview.mealType ? preview.mealType.charAt(0).toUpperCase() + preview.mealType.slice(1).toLowerCase() : 'meal'}`}
        </span>
        {!repeating ? (
          <span className="max-w-full truncate text-center text-xs text-[var(--app-text-muted)]" title={previewLine}>
            {previewLine}
          </span>
        ) : null}
      </button>
    </div>
  )
}
