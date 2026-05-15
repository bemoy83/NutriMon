import { render, waitFor } from '@testing-library/react'
import { BarcodeFormat } from '@zxing/library'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useBarcodeScanner } from '../useBarcodeScanner'

const mocks = vi.hoisted(() => ({
  decodeFromConstraints: vi.fn(),
  applyConstraints: vi.fn(),
  getCapabilities: vi.fn(),
  getVideoTracks: vi.fn(),
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
  const { videoRef, status, errorMessage } = useBarcodeScanner({ active, paused, onDetect })
  return (
    <>
      <video ref={videoRef} />
      <p>{status}</p>
      {errorMessage && <p>{errorMessage}</p>}
    </>
  )
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
    mocks.getCapabilities.mockReturnValue({})
    mocks.applyConstraints.mockResolvedValue(undefined)
    mocks.getVideoTracks.mockReturnValue([{
      getCapabilities: mocks.getCapabilities,
      applyConstraints: mocks.applyConstraints,
    }])
    mocks.decodeFromConstraints.mockImplementation(async (_constraints, preview) => {
      Object.defineProperty(preview, 'srcObject', {
        configurable: true,
        value: { getVideoTracks: mocks.getVideoTracks },
      })
      return { stop: vi.fn() }
    })
  })

  it('starts the scanner with environment camera and ideal scanner video settings', async () => {
    render(<TestScanner onDetect={vi.fn()} />)

    await waitFor(() => expect(mocks.decodeFromConstraints).toHaveBeenCalled())

    expect(mocks.decodeFromConstraints.mock.calls[0][0]).toEqual({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      },
    })
  })

  it('prefers continuous focus when the camera supports it', async () => {
    mocks.getCapabilities.mockReturnValue({ focusMode: ['auto', 'continuous'] })

    render(<TestScanner onDetect={vi.fn()} />)

    await waitFor(() => {
      expect(mocks.applyConstraints).toHaveBeenCalledWith({
        advanced: [{ focusMode: 'continuous' }],
      })
    })
  })

  it('falls back to auto focus when continuous focus is unavailable', async () => {
    mocks.getCapabilities.mockReturnValue({ focusMode: ['auto'] })

    render(<TestScanner onDetect={vi.fn()} />)

    await waitFor(() => {
      expect(mocks.applyConstraints).toHaveBeenCalledWith({
        advanced: [{ focusMode: 'auto' }],
      })
    })
  })

  it('adds a conservative near focus distance when the camera exposes a focus range', async () => {
    mocks.getCapabilities.mockReturnValue({
      focusMode: ['continuous'],
      focusDistance: { min: 0, max: 10, step: 0.5 },
    })

    render(<TestScanner onDetect={vi.fn()} />)

    await waitFor(() => {
      expect(mocks.applyConstraints).toHaveBeenCalledWith({
        advanced: [{ focusMode: 'continuous', focusDistance: 2 }],
      })
    })
  })

  it('does not apply focus constraints when focus capabilities are absent', async () => {
    render(<TestScanner onDetect={vi.fn()} />)

    await waitFor(() => expect(mocks.decodeFromConstraints).toHaveBeenCalled())

    expect(mocks.applyConstraints).not.toHaveBeenCalled()
  })

  it('ignores focus tuning failures and still enters scanning status', async () => {
    mocks.getCapabilities.mockReturnValue({ focusMode: ['continuous'] })
    mocks.applyConstraints.mockRejectedValue(new Error('Unsupported focus constraint'))

    render(<TestScanner onDetect={vi.fn()} />)

    await waitFor(() => expect(document.body).toHaveTextContent('scanning'))
    expect(document.body).not.toHaveTextContent('Unsupported focus constraint')
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
