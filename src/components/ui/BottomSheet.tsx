import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

interface BottomSheetProps {
  children: ReactNode
  onClose: () => void
  title: string
  titleContent?: ReactNode
  footer?: ReactNode
  className?: string
}

const DISMISS_THRESHOLD = 80

export default function BottomSheet({ children, onClose, title, titleContent, footer, className }: BottomSheetProps) {
  const [dragY, setDragY] = useState(0)
  const [transitioning, setTransitioning] = useState(false)
  const startYRef = useRef(0)
  const onCloseRef = useRef(onClose)
  useLayoutEffect(() => { onCloseRef.current = onClose })

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  function handleTouchStart(e: React.TouchEvent) {
    startYRef.current = e.touches[0].clientY
    setTransitioning(false)
  }

  function handleTouchMove(e: React.TouchEvent) {
    const delta = e.touches[0].clientY - startYRef.current
    if (delta > 0) setDragY(delta)
  }

  function handleTouchEnd() {
    if (dragY > DISMISS_THRESHOLD) {
      onClose()
    } else {
      setTransitioning(true)
      setDragY(0)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl border border-[var(--app-border)] bg-white sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl${className ? ` ${className}` : ' max-h-[85vh]'}`}
        style={{
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: transitioning ? 'transform 0.2s ease' : undefined,
        }}
        onTransitionEnd={() => setTransitioning(false)}
      >
        {/* Header — drag target on mobile */}
        <div
          className="flex flex-col rounded-t-2xl bg-white sm:rounded-t-xl"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex justify-center pt-2 sm:hidden">
            <div className="w-10 h-1 rounded-full bg-slate-300" />
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <h3 className="text-base font-semibold text-[var(--app-text-primary)]">{titleContent ?? title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-elevated)] hover:text-[var(--app-text-primary)]"
              aria-label={`Close ${title}`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>

        {footer && (
          <div className="bg-white px-4 py-5 border-t border-[var(--app-border-muted)]">
            {footer}
          </div>
        )}
      </div>
    </>
  )
}
