import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { NotFoundException } from '@zxing/library'

export type ScanStatus = 'idle' | 'requesting' | 'scanning' | 'denied' | 'error'

export function useBarcodeScanner({
  active,
  onDetect,
}: {
  active: boolean
  onDetect: (ean: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<ScanStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // stable ref so the effect doesn't re-run when onDetect identity changes
  const onDetectRef = useRef(onDetect)
  useEffect(() => { onDetectRef.current = onDetect })

  useEffect(() => {
    if (!active) {
      setStatus('idle')
      setErrorMessage(null)
      return
    }

    const reader = new BrowserMultiFormatReader()
    let stopped = false
    let controls: { stop: () => void } | null = null
    let lastEan: string | null = null

    setStatus('requesting')
    setErrorMessage(null)

    async function start() {
      try {
        if (!videoRef.current) return
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: 'environment' } },
          videoRef.current,
          (result, error) => {
            if (stopped) return
            if (result) {
              const text = result.getText()
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

  return { videoRef, status, errorMessage }
}
