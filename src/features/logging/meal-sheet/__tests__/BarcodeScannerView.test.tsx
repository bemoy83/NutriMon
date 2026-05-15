import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BarcodeScannerView from '../BarcodeScannerView'

const useBarcodeScannerMock = vi.fn()

vi.mock('../useBarcodeScanner', () => ({
  useBarcodeScanner: (args: unknown) => useBarcodeScannerMock(args),
}))

describe('BarcodeScannerView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useBarcodeScannerMock.mockReturnValue({
      videoRef: { current: null },
      status: 'scanning',
      errorMessage: null,
    })
  })

  it('does not submit manual digits while typing', () => {
    const onEan = vi.fn()

    render(
      <BarcodeScannerView
        active
        onEan={onEan}
        barcodeLoading={false}
        barcodeError={null}
        onCancel={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText(/Or type EAN barcode/), {
      target: { value: '7038011234567' },
    })

    expect(onEan).not.toHaveBeenCalled()
  })

  it('submits normalized manual EAN on Enter or button', () => {
    const onEan = vi.fn()

    render(
      <BarcodeScannerView
        active
        onEan={onEan}
        barcodeLoading={false}
        barcodeError={null}
        onCancel={vi.fn()}
      />,
    )

    const input = screen.getByPlaceholderText(/Or type EAN barcode/)
    fireEvent.change(input, { target: { value: '70 38-011234567' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Lookup' }))

    expect(onEan).toHaveBeenCalledTimes(2)
    expect(onEan).toHaveBeenNthCalledWith(1, '7038011234567')
    expect(onEan).toHaveBeenNthCalledWith(2, '7038011234567')
  })

  it('pauses the scanner hook while barcode lookup is loading', () => {
    render(
      <BarcodeScannerView
        active
        onEan={vi.fn()}
        barcodeLoading
        barcodeError={null}
        onCancel={vi.fn()}
      />,
    )

    expect(useBarcodeScannerMock).toHaveBeenCalledWith(expect.objectContaining({ paused: true }))
  })
})
