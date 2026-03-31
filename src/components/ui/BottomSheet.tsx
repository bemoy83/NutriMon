import { useEffect } from 'react'
import type { ReactNode } from 'react'

interface BottomSheetProps {
  children: ReactNode
  onClose: () => void
  title: string
  footer?: ReactNode
  className?: string
}

export default function BottomSheet({ children, onClose, title, footer, className }: BottomSheetProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className={`fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl border border-[var(--app-border)] bg-[var(--app-surface-elevated)] sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl${className ? ` ${className}` : ' max-h-[85vh]'}`}>
        <div className="flex items-center justify-between border-b border-[var(--app-border)] px-4 py-3">
          <h3 className="font-semibold text-[var(--app-text-primary)]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[var(--app-text-muted)] transition-colors hover:text-[var(--app-text-primary)]"
            aria-label={`Close ${title}`}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
        {footer ? <div className="border-t border-[var(--app-border)] p-4">{footer}</div> : null}
      </div>
    </>
  )
}
