interface DailyLogRepeatCtaProps {
  repeating: boolean
  repeatError: string | null
  onRepeat: () => void
  className?: string
}

export default function DailyLogRepeatCta({
  repeating,
  repeatError,
  onRepeat,
  className = '',
}: DailyLogRepeatCtaProps) {
  return (
    <div className={`flex flex-col ${className}`}>
      {repeatError ? (
        <p className="mb-1 text-center text-xs text-[var(--app-danger)]">{repeatError}</p>
      ) : null}
      <button
        type="button"
        onClick={onRepeat}
        disabled={repeating}
        className="flex-1 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] py-3 text-sm font-medium text-[var(--app-text-primary)] shadow-sm transition-colors hover:bg-[var(--app-surface-elevated)] disabled:opacity-50"
      >
        {repeating ? 'Repeating…' : 'Repeat last meal'}
      </button>
    </div>
  )
}
