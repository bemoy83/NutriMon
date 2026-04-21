import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useState } from 'react'
import { useDailyLogHeaderCompact } from '../useDailyLogHeaderCompact'

function HeaderCompactProbe({ showPage }: { showPage: boolean }) {
  const [anchor, setAnchor] = useState<HTMLDivElement | null>(null)
  const compact = useDailyLogHeaderCompact(anchor, '2026-01-05')

  return (
    <main data-testid="scroll-root" style={{ overflowY: 'auto', maxHeight: '200px' }}>
      <div data-testid="mode">{compact ? 'compact' : 'full'}</div>
      {showPage ? (
        <div ref={setAnchor}>
          <div style={{ height: '1200px' }}>Daily log content</div>
        </div>
      ) : (
        <div>Loading…</div>
      )}
    </main>
  )
}

describe('useDailyLogHeaderCompact', () => {
  it('starts listening when the scroll anchor mounts after loading', async () => {
    const { rerender } = render(<HeaderCompactProbe showPage={false} />)

    expect(screen.getByTestId('mode')).toHaveTextContent('full')

    rerender(<HeaderCompactProbe showPage />)

    const scrollRoot = screen.getByTestId('scroll-root')
    scrollRoot.scrollTop = 72
    fireEvent.scroll(scrollRoot)

    await waitFor(() => {
      expect(screen.getByTestId('mode')).toHaveTextContent('compact')
    })

    scrollRoot.scrollTop = 0
    fireEvent.scroll(scrollRoot)

    await waitFor(() => {
      expect(screen.getByTestId('mode')).toHaveTextContent('full')
    })
  })
})
