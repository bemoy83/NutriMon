import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import BottomSheet from '../BottomSheet'

describe('BottomSheet', () => {
  it('closes when escape is pressed', () => {
    const onClose = vi.fn()

    render(
      <BottomSheet title="Add meal" onClose={onClose}>
        <div>content</div>
      </BottomSheet>,
    )

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes when the backdrop is clicked', () => {
    const onClose = vi.fn()
    const { container } = render(
      <BottomSheet title="Add meal" onClose={onClose}>
        <div>content</div>
      </BottomSheet>,
    )

    fireEvent.click(container.querySelector('[aria-hidden="true"]')!)

    expect(screen.getByText('content')).toBeInTheDocument()
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
