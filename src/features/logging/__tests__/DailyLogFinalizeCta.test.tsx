import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import DailyLogFinalizeCta from '../DailyLogFinalizeCta'

describe('DailyLogFinalizeCta', () => {
  it('asks for confirmation before finalizing by default', () => {
    const onFinalize = vi.fn()

    render(
      <DailyLogFinalizeCta
        finalizing={false}
        finalizeError={null}
        onFinalize={onFinalize}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Finalize & Prep' }))

    expect(onFinalize).not.toHaveBeenCalled()
    expect(screen.getByRole('alertdialog', { name: 'Finalize today?' })).toBeInTheDocument()
    expect(screen.getByText(/locks the logged food for the day/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Finalize day' }))

    expect(onFinalize).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('lets users back out and keep logging', () => {
    const onFinalize = vi.fn()

    render(
      <DailyLogFinalizeCta
        finalizing={false}
        finalizeError={null}
        onFinalize={onFinalize}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Finalize & Prep' }))
    fireEvent.click(screen.getByRole('button', { name: 'Keep logging' }))

    expect(onFinalize).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('can skip confirmation for low-risk late-day finalization', () => {
    const onFinalize = vi.fn()

    render(
      <DailyLogFinalizeCta
        finalizing={false}
        finalizeError={null}
        onFinalize={onFinalize}
        requiresConfirmation={false}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Finalize & Prep' }))

    expect(onFinalize).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})
