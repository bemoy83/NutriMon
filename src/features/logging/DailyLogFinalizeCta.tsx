interface DailyLogFinalizeCtaProps {
  finalizing: boolean
  finalizeError: string | null
  onFinalize: () => void
  className?: string
}

export default function DailyLogFinalizeCta({
  finalizing,
  finalizeError,
  onFinalize,
  className = '',
}: DailyLogFinalizeCtaProps) {
  return (
    <div className={`flex flex-col ${className}`}>
      {finalizeError ? (
        <p className="mb-1 text-center text-xs text-[var(--app-danger)]">{finalizeError}</p>
      ) : null}
      <button
        type="button"
        onClick={onFinalize}
        disabled={finalizing}
        className="flex-1 rounded-xl bg-[var(--app-brand)] py-3 font-medium text-white shadow-[0_4px_16px_rgb(124_58_237/0.35)] transition-colors hover:bg-[var(--app-brand-hover)] disabled:opacity-50"
      >
        {finalizing ? 'Finalizing…' : 'Finalize & Prep'}
      </button>
    </div>
  )
}
