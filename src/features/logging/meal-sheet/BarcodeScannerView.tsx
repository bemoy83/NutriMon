import { useState, useEffect } from 'react'
import { useBarcodeScanner } from './useBarcodeScanner'

const EAN_RE = /^\d{8,14}$/

interface BarcodeScannerViewProps {
  active: boolean
  onEan: (ean: string) => void
  barcodeLoading: boolean
  barcodeError: string | null
  onCancel: () => void
}

export default function BarcodeScannerView({
  active,
  onEan,
  barcodeLoading,
  barcodeError,
  onCancel,
}: BarcodeScannerViewProps) {
  const { videoRef, status, errorMessage: cameraError } = useBarcodeScanner({ active, onDetect: onEan })
  const [ean, setEan] = useState('')
  const [manualError, setManualError] = useState<string | null>(null)

  useEffect(() => {
    if (!active) return
    setEan('')
    setManualError(null)
  }, [active])

  function handleEanChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '')
    setEan(digits)
    setManualError(null)
    if (EAN_RE.test(digits)) onEan(digits)
  }

  function handleEanKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      if (EAN_RE.test(ean)) onEan(ean)
      else setManualError('Enter a valid 8–14 digit EAN')
    }
    if (e.key === 'Escape') onCancel()
  }

  const statusText =
    status === 'requesting' ? 'Requesting camera access…' :
    status === 'denied' ? 'Camera access denied — use the field below' :
    status === 'error' ? (cameraError ?? 'Camera unavailable') :
    status === 'scanning' ? 'Point camera at barcode' :
    null

  const displayError = barcodeError ?? manualError

  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: '#000' }}>
      {/* viewfinder */}
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          playsInline
        />

        {/* dark surround — four quadrants around the crop rect */}
        <div className="absolute inset-0 pointer-events-none">
          {/* top */}
          <div className="absolute top-0 left-0 right-0" style={{ height: '30%', background: 'rgba(0,0,0,0.55)' }} />
          {/* bottom */}
          <div className="absolute bottom-0 left-0 right-0" style={{ height: '40%', background: 'rgba(0,0,0,0.55)' }} />
          {/* left */}
          <div className="absolute" style={{ top: '30%', bottom: '40%', left: 0, width: '10%', background: 'rgba(0,0,0,0.55)' }} />
          {/* right */}
          <div className="absolute" style={{ top: '30%', bottom: '40%', right: 0, width: '10%', background: 'rgba(0,0,0,0.55)' }} />
          {/* crop rect border */}
          <div
            className="absolute"
            style={{
              top: '30%', bottom: '40%',
              left: '10%', right: '10%',
              border: '2px solid rgba(255,255,255,0.9)',
              borderRadius: 8,
            }}
          />
          {/* status text below crop rect */}
          {statusText && (
            <div className="absolute left-0 right-0 flex justify-center" style={{ top: 'calc(60% + 12px)' }}>
              <p
                className="text-sm font-medium px-3 py-1 rounded-full"
                style={{
                  color: status === 'denied' || status === 'error' ? '#fca5a5' : 'rgba(255,255,255,0.9)',
                  background: 'rgba(0,0,0,0.4)',
                }}
              >
                {statusText}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* bottom panel */}
      <div className="flex-none bg-white px-4 pt-3 pb-5 flex flex-col gap-2">
        <div className="relative">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={ean}
            onChange={handleEanChange}
            onKeyDown={handleEanKeyDown}
            placeholder="Or type EAN barcode…"
            maxLength={14}
            disabled={barcodeLoading}
            className="app-input box-border h-10 w-full px-4 pr-10 text-sm !rounded-[var(--app-radius-lg)]"
          />
          {barcodeLoading && (
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
              <svg className="animate-spin h-4 w-4 text-[var(--app-text-muted)]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            </div>
          )}
        </div>
        {displayError && (
          <p className="px-1 text-xs" style={{ color: 'var(--app-destructive)' }}>{displayError}</p>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="h-10 w-full rounded-[var(--app-radius-lg)] text-sm font-medium transition-colors hover:bg-[var(--app-surface-muted)]"
          style={{ color: 'var(--app-text-muted)' }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
