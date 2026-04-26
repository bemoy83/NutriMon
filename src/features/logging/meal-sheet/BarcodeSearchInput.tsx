import { useState, useRef, useEffect } from 'react'
import { useKassalappBarcode } from '../useKassalappBarcode'
import type { KassalappProduct } from '@/lib/kassalapp'

interface BarcodeSearchInputProps {
  onProduct: (product: KassalappProduct) => void
}

function BarcodeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 5h2M7 5h1M11 5h1M14 5h2M17 5h1M20 5h1M3 19h2M7 19h1M11 19h1M14 19h2M17 19h1M20 19h1" />
      <rect x="3" y="3" width="4" height="18" rx="0.5" />
      <rect x="9" y="3" width="2" height="18" rx="0.5" />
      <rect x="13" y="3" width="4" height="18" rx="0.5" />
      <rect x="19" y="3" width="2" height="18" rx="0.5" />
    </svg>
  )
}

export default function BarcodeSearchInput({ onProduct }: BarcodeSearchInputProps) {
  const [open, setOpen] = useState(false)
  const [ean, setEan] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const { data, isFetching, isError, error } = useKassalappBarcode(ean)

  // Auto-focus input when panel opens
  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // Fire onProduct as soon as a result arrives
  useEffect(() => {
    if (data) {
      onProduct(data)
      setEan('')
      setOpen(false)
    }
  }, [data, onProduct])

  const notFound = !isFetching && !isError && data === null && ean.trim().length >= 8

  const errorMessage = isError
    ? error instanceof Error
      ? error.message
      : 'Lookup failed'
    : notFound
      ? 'No product found for this barcode'
      : null

  function handleToggle() {
    setOpen((o) => !o)
    if (open) setEan('')
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleToggle}
        aria-label="Scan barcode"
        aria-pressed={open}
        className="flex h-10 w-10 flex-none items-center justify-center rounded-[var(--app-radius-lg)] transition-colors"
        style={{
          background: open ? 'var(--app-brand)' : 'var(--app-surface-muted)',
          color: open ? '#fff' : 'var(--app-text-muted)',
        }}
      >
        <BarcodeIcon />
      </button>

      {open && (
        <div className="mt-2 px-4 pb-1">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={ean}
              onChange={(e) => setEan(e.target.value.replace(/\D/g, ''))}
              placeholder="Enter EAN barcode…"
              maxLength={14}
              className="app-input box-border h-10 w-full px-4 pr-10 text-sm !rounded-[var(--app-radius-lg)]"
            />
            {isFetching && (
              <div className="absolute inset-y-0 right-3 flex items-center">
                <svg className="animate-spin h-4 w-4 text-[var(--app-text-muted)]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              </div>
            )}
          </div>
          {errorMessage && (
            <p className="mt-1.5 text-xs text-[var(--app-destructive)]">{errorMessage}</p>
          )}
          <p className="mt-1.5 text-[11px] text-[var(--app-text-subtle)]">
            Camera scanning coming soon — type or paste the EAN number for now
          </p>
        </div>
      )}
    </div>
  )
}
