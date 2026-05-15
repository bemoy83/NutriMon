import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { BarcodeFormat, NotFoundException } from '@zxing/library'
import { normalizeEan } from '@/lib/ean'

export type ScanStatus = 'idle' | 'requesting' | 'scanning' | 'denied' | 'error'

const EAN_BARCODE_FORMATS = new Set<BarcodeFormat>([
  BarcodeFormat.EAN_8,
  BarcodeFormat.EAN_13,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
])

type FocusDistanceRange = { min?: number; max?: number; step?: number }
type BarcodeTrackCapabilities = MediaTrackCapabilities & {
  focusMode?: string[]
  focusDistance?: FocusDistanceRange
}
type BarcodeTrackConstraintSet = MediaTrackConstraintSet & {
  focusMode?: string
  focusDistance?: number
}

const SCANNER_VIDEO_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 },
  },
}

function chooseNearFocusDistance(range: FocusDistanceRange): number | null {
  const min = range.min
  const max = range.max
  if (typeof min !== 'number' || typeof max !== 'number' || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return null
  }

  const nearDistance = min + (max - min) * 0.2
  const step = range.step
  if (typeof step !== 'number' || !Number.isFinite(step) || step <= 0) return nearDistance
  return min + Math.round((nearDistance - min) / step) * step
}

async function tuneTrackForBarcodeScanning(video: HTMLVideoElement): Promise<void> {
  const stream = video.srcObject as ({ getVideoTracks?: () => MediaStreamTrack[] } | null)
  const track = stream?.getVideoTracks?.()[0]
  if (!track) return

  const capabilities = track.getCapabilities() as BarcodeTrackCapabilities
  const focusConstraint: BarcodeTrackConstraintSet = {}
  if (capabilities.focusMode?.includes('continuous')) {
    focusConstraint.focusMode = 'continuous'
  } else if (capabilities.focusMode?.includes('auto')) {
    focusConstraint.focusMode = 'auto'
  }

  const focusDistance = capabilities.focusDistance ? chooseNearFocusDistance(capabilities.focusDistance) : null
  if (focusDistance != null) {
    focusConstraint.focusDistance = focusDistance
  }

  if (Object.keys(focusConstraint).length === 0) return
  await track.applyConstraints({ advanced: [focusConstraint] })
}

export function useBarcodeScanner({
  active,
  paused = false,
  onDetect,
}: {
  active: boolean
  paused?: boolean
  onDetect: (ean: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<ScanStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // stable ref so the effect doesn't re-run when onDetect identity changes
  const onDetectRef = useRef(onDetect)
  useEffect(() => { onDetectRef.current = onDetect })
  const pausedRef = useRef(paused)
  useEffect(() => { pausedRef.current = paused })

  useEffect(() => {
    if (!active) return

    const reader = new BrowserMultiFormatReader()
    let stopped = false
    let controls: { stop: () => void } | null = null
    let lastEan: string | null = null

    async function start() {
      setStatus('requesting')
      setErrorMessage(null)
      try {
        if (!videoRef.current) return
        controls = await reader.decodeFromConstraints(
          SCANNER_VIDEO_CONSTRAINTS,
          videoRef.current,
          (result, error) => {
            if (stopped) return
            if (result && !pausedRef.current) {
              if (!EAN_BARCODE_FORMATS.has(result.getBarcodeFormat())) return
              const text = normalizeEan(result.getText())
              if (!text) return
              // deduplicate: don't fire for the same EAN on consecutive frames
              if (text !== lastEan) {
                lastEan = text
                onDetectRef.current(text)
              }
              return
            }
            if (error && !(error instanceof NotFoundException)) {
              setStatus('error')
              setErrorMessage(error.message)
            }
          },
        )
        try {
          if (!stopped && videoRef.current) await tuneTrackForBarcodeScanning(videoRef.current)
        } catch {
          // Camera focus controls are browser/device-specific; scanning still works without them.
        }
        if (!stopped) setStatus('scanning')
      } catch (e) {
        if (stopped) return
        const err = e as Error
        if (err.name === 'NotAllowedError') {
          setStatus('denied')
        } else {
          setStatus('error')
          setErrorMessage(err.message)
        }
      }
    }

    start()

    return () => {
      stopped = true
      controls?.stop()
      setStatus('idle')
      setErrorMessage(null)
    }
  }, [active])

  // when inactive, always surface idle/null regardless of internal state
  return {
    videoRef,
    status: active ? status : 'idle' as ScanStatus,
    errorMessage: active ? errorMessage : null,
  }
}
