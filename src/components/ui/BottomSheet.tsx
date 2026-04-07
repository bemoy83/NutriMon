import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

interface BottomSheetProps {
  children: ReactNode
  onClose: () => void
  title: string
  footer?: ReactNode
  className?: string
}

export default function BottomSheet({ children, onClose, title, footer, className }: BottomSheetProps) {
  const [dragY, setDragY] = useState(0)
  const [snapping, setSnapping] = useState(false)
  const startYRef = useRef(0)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function handleTouchStart(e: React.TouchEvent) {
    startYRef.current = e.touches[0].clientY
    setSnapping(false)
  }

  function handleTouchMove(e: React.TouchEvent) {
    const deltaY = e.touches[0].clientY - startYRef.current
    if (deltaY > 0) setDragY(deltaY)
  }

  function handleTouchEnd() {
    if (dragY > 80) {
      onClose()
    } else {
      setSnapping(true)
      setDragY(0)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        className={`fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl border border-[var(--app-border)] bg-[var(--app-surface)] sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl${className ? ` ${className}` : ' max-h-[85vh]'}`}
        style={{
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: snapping ? 'transform 0.2s ease' : undefined,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle — mobile only */}
        <div className="flex justify-center pt-2 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-[var(--app-border)]" />
        </div>

        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="text-base font-semibold text-[var(--app-text-primary)]">{title}</h3>
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
        {footer ? (
          <div className="relative z-[1] bg-[var(--app-surface)] p-4 shadow-[0_-4px_14px_-4px_rgb(15_23_42_/_0.1)]">
            {footer}
          </div>
        ) : null}
      </div>
    </>
  )
}
