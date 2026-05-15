import { useEffect, useId, useState } from 'react'

interface DailyLogFinalizeCtaProps {
  finalizing: boolean
  finalizeError: string | null
  onFinalize: () => void
  requiresConfirmation?: boolean
  className?: string
}

export default function DailyLogFinalizeCta({
  finalizing,
  finalizeError,
  onFinalize,
  requiresConfirmation = true,
  className = '',
}: DailyLogFinalizeCtaProps) {
  const [showConfirm, setShowConfirm] = useState(false)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (!showConfirm) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !finalizing) setShowConfirm(false)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [finalizing, showConfirm])

  function handleFinalizeClick() {
    if (requiresConfirmation) {
      setShowConfirm(true)
      return
    }

    onFinalize()
  }

  function handleConfirm() {
    onFinalize()
    setShowConfirm(false)
  }

  return (
    <div className={`flex flex-col ${className}`}>
      {finalizeError ? (
        <p className="mb-1 text-center text-xs text-[var(--app-danger)]">{finalizeError}</p>
      ) : null}
      <button
        type="button"
        onClick={handleFinalizeClick}
        disabled={finalizing}
        className="flex-1 rounded-[var(--app-radius-xl)] bg-[var(--app-brand)] py-3 font-medium text-white shadow-[0_4px_16px_rgb(124_58_237/0.35)] transition-colors hover:bg-[var(--app-brand-hover)] disabled:opacity-50"
      >
        {finalizing ? 'Finalizing…' : 'Finalize & Prep'}
      </button>

      {showConfirm ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            aria-hidden="true"
            onClick={() => {
              if (!finalizing) setShowConfirm(false)
            }}
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-[var(--app-radius-xl)] border border-[var(--app-border)] bg-white p-5 shadow-[var(--app-shadow-lg)]"
          >
            <h2 id={titleId} className="text-lg font-semibold text-[var(--app-text-primary)]">
              Finalize today?
            </h2>
            <p id={descriptionId} className="mt-2 text-sm leading-5 text-[var(--app-text-muted)]">
              This locks the logged food for the day and prepares tomorrow&apos;s battle stats. You can keep logging if you are not done yet.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={finalizing}
                className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-white px-3 py-2.5 text-sm font-medium text-[var(--app-text-secondary)] transition-colors hover:bg-[var(--app-surface-muted)] disabled:opacity-50"
              >
                Keep logging
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={finalizing}
                className="rounded-[var(--app-radius-lg)] bg-[var(--app-brand)] px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--app-brand-hover)] disabled:opacity-50"
              >
                Finalize day
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
