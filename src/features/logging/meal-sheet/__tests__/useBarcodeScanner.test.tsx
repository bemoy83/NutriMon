import { render, waitFor } from '@testing-library/react'
import { BarcodeFormat } from '@zxing/library'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useBarcodeScanner } from '../useBarcodeScanner'

const mocks = vi.hoisted(() => ({
  decodeFromConstraints: vi.fn(),
}))

vi.mock('@zxing/browser', () => ({
  BrowserMultiFormatReader: vi.fn(function BrowserMultiFormatReader() {
    return { decodeFromConstraints: mocks.decodeFromConstraints }
  }),
}))

function TestScanner({
  active = true,
  paused = false,
  onDetect,
}: {
  active?: boolean
  paused?: boolean
  onDetect: (ean: string) => void
}) {
  const { videoRef } = useBarcodeScanner({ active, paused, onDetect })
  return <video ref={videoRef} />
}

function result(text: string, format: BarcodeFormat) {
  return {
    getText: () => text,
    getBarcodeFormat: () => format,
  }
}

describe('useBarcodeScanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.decodeFromConstraints.mockResolvedValue({ stop: vi.fn() })
  })

  it('ignores non-EAN scanner formats', async () => {
    const onDetect = vi.fn()
    render(<TestScanner onDetect={onDetect} />)

    await waitFor(() => expect(mocks.decodeFromConstraints).toHaveBeenCalled())
    const callback = mocks.decodeFromConstraints.mock.calls[0][2]
    callback(result('7038011234567', BarcodeFormat.QR_CODE), null)

    expect(onDetect).not.toHaveBeenCalled()
  })

  it('dedupes repeated EAN frames', async () => {
    const onDetect = vi.fn()
    render(<TestScanner onDetect={onDetect} />)

    await waitFor(() => expect(mocks.decodeFromConstraints).toHaveBeenCalled())
    const callback = mocks.decodeFromConstraints.mock.calls[0][2]
    callback(result('7038011234567', BarcodeFormat.EAN_13), null)
    callback(result('7038011234567', BarcodeFormat.EAN_13), null)

    expect(onDetect).toHaveBeenCalledTimes(1)
    expect(onDetect).toHaveBeenCalledWith('7038011234567')
  })

  it('ignores detections while paused', async () => {
    const onDetect = vi.fn()
    render(<TestScanner paused onDetect={onDetect} />)

    await waitFor(() => expect(mocks.decodeFromConstraints).toHaveBeenCalled())
    const callback = mocks.decodeFromConstraints.mock.calls[0][2]
    callback(result('7038011234567', BarcodeFormat.EAN_13), null)

    expect(onDetect).not.toHaveBeenCalled()
  })
})
