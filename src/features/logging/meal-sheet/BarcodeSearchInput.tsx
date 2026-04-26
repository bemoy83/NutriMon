import { useState, useRef, useEffect } from 'react'
import { lookupBarcode, type KassalappProduct } from '@/lib/kassalapp'

const EAN_RE = /^\d{8,14}$/

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
  const [searching, setSearching] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  function handleToggle() {
    setOpen((o) => !o)
    if (open) {
      setEan('')
      setNotFound(false)
      setErrorMessage(null)
    }
  }

  async function handleSearch(value: string) {
    const trimmed = value.trim()
    if (!EAN_RE.test(trimmed)) return
    setSearching(true)
    setNotFound(false)
    setErrorMessage(null)
    try {
      const product = await lookupBarcode(trimmed)
      if (product) {
        onProduct(product)
        setEan('')
        setOpen(false)
      } else {
        setNotFound(true)
      }
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'Lookup failed')
    } finally {
      setSearching(false)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '')
    setEan(digits)
    setNotFound(false)
    setErrorMessage(null)
    if (EAN_RE.test(digits)) handleSearch(digits)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSearch(ean)
  }

  const displayError = errorMessage ?? (notFound ? 'No product found for this barcode' : null)

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
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="Enter EAN barcode…"
              maxLength={14}
              className="app-input box-border h-10 w-full px-4 pr-10 text-sm !rounded-[var(--app-radius-lg)]"
            />
            {searching && (
              <div className="absolute inset-y-0 right-3 flex items-center">
                <svg className="animate-spin h-4 w-4 text-[var(--app-text-muted)]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              </div>
            )}
          </div>
          {displayError && (
            <p className="mt-1.5 text-xs text-[var(--app-destructive)]">{displayError}</p>
          )}
          <p className="mt-1.5 text-[11px] text-[var(--app-text-subtle)]">
            Camera scanning coming soon — type or paste the EAN number for now
          </p>
        </div>
      )}
    </div>
  )
}
