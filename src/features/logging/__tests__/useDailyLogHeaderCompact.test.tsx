import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useState } from 'react'
import { useDailyLogHeaderCompact } from '../useDailyLogHeaderCompact'

function HeaderCompactProbe({ showPage }: { showPage: boolean }) {
  const [scrollAnchor, setScrollAnchor] = useState<HTMLDivElement | null>(null)
  const [dateSticky, setDateSticky] = useState<HTMLDivElement | null>(null)
  const [fullHeader, setFullHeader] = useState<HTMLDivElement | null>(null)
  const compact = useDailyLogHeaderCompact({
    scrollAnchor,
    dateSticky,
    fullHeader,
    resetKey: '2026-01-05',
  })

  return (
    <main data-testid="scroll-root" style={{ overflowY: 'auto', maxHeight: '200px' }}>
      <div data-testid="mode">{compact ? 'compact' : 'full'}</div>
      {showPage ? (
        <div ref={setScrollAnchor}>
          <div ref={setDateSticky} data-testid="date-sticky">
            Sticky date
          </div>
          <div ref={setFullHeader} data-testid="full-header">
            Full header
          </div>
          <div style={{ height: '1200px' }}>Daily log content</div>
        </div>
      ) : (
        <div>Loading…</div>
      )}
    </main>
  )
}

describe('useDailyLogHeaderCompact', () => {
  it('toggles based on the full header position relative to the sticky date row', async () => {
    const originalRaf = window.requestAnimationFrame
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      cb(0)
      return 0
    }) as typeof window.requestAnimationFrame

    try {
    const { rerender } = render(<HeaderCompactProbe showPage={false} />)

    expect(screen.getByTestId('mode')).toHaveTextContent('full')

    rerender(<HeaderCompactProbe showPage />)

    const scrollRoot = screen.getByTestId('scroll-root')
    const dateSticky = screen.getByTestId('date-sticky')
    const fullHeader = screen.getByTestId('full-header')

    dateSticky.getBoundingClientRect = () =>
      ({ bottom: 64 } as DOMRect)
    fullHeader.getBoundingClientRect = () =>
      ({ top: 120 } as DOMRect)

    scrollRoot.scrollTop = 0
    fireEvent.scroll(scrollRoot)

    await waitFor(() => {
      expect(screen.getByTestId('mode')).toHaveTextContent('full')
    })

    fullHeader.getBoundingClientRect = () =>
      ({ top: 76 } as DOMRect)

    scrollRoot.scrollTop = 80
    fireEvent.scroll(scrollRoot)

    await waitFor(() => {
      expect(screen.getByTestId('mode')).toHaveTextContent('compact')
    })

    fullHeader.getBoundingClientRect = () =>
      ({ top: 104 } as DOMRect)

    scrollRoot.scrollTop = 0
    fireEvent.scroll(scrollRoot)

    await waitFor(() => {
      expect(screen.getByTestId('mode')).toHaveTextContent('full')
    })
    } finally {
      window.requestAnimationFrame = originalRaf
    }
  })
})
