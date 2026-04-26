import { useState, useRef, useEffect } from 'react'
import { lookupBarcode, type KassalappProduct } from '@/lib/kassalapp'

const EAN_RE = /^\d{8,14}$/

interface BarcodeSearchInputProps {
  searchQuery: string
  onSearchQueryChange: (q: string) => void
  onProduct: (product: KassalappProduct) => void
}

function BarcodeIcon({ color }: { color: string }) {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 22H4.4A2.4 2.4 0 0 1 2 19.6V18m16 4h1.6a2.4 2.4 0 0 0 2.4-2.4V18m0-12V4.4A2.4 2.4 0 0 0 19.6 2H18M6 2H4.4A2.4 2.4 0 0 0 2 4.4V6" />
      <path d="M18 9v6M14 9v6M10 9v6M6 9v6" />
    </svg>
  )
}

export default function BarcodeSearchInput({ searchQuery, onSearchQueryChange, onProduct }: BarcodeSearchInputProps) {
  const [scanning, setScanning] = useState(false)
  const [ean, setEan] = useState('')
  const [loading, setLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const eanInputRef = useRef<HTMLInputElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (scanning) {
      eanInputRef.current?.focus()
    } else {
      searchInputRef.current?.focus()
    }
  }, [scanning])

  function openScanner() {
    setEan('')
    setNotFound(false)
    setErrorMessage(null)
    setScanning(true)
  }

  function closeScanner() {
    setScanning(false)
    setEan('')
    setNotFound(false)
    setErrorMessage(null)
  }

  async function handleSearch(value: string) {
    const trimmed = value.trim()
    if (!EAN_RE.test(trimmed)) return
    setLoading(true)
    setNotFound(false)
    setErrorMessage(null)
    try {
      const product = await lookupBarcode(trimmed)
      if (product) {
        onProduct(product)
        closeScanner()
      } else {
        setNotFound(true)
      }
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'Lookup failed')
    } finally {
      setLoading(false)
    }
  }

  function handleEanChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '')
    setEan(digits)
    setNotFound(false)
    setErrorMessage(null)
    if (EAN_RE.test(digits)) handleSearch(digits)
  }

  function handleEanKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSearch(ean)
    if (e.key === 'Escape') closeScanner()
  }

  const displayError = errorMessage ?? (notFound ? 'No product found for this barcode' : null)

  if (scanning) {
    return (
      <div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              ref={eanInputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={ean}
              onChange={handleEanChange}
              onKeyDown={handleEanKeyDown}
              placeholder="Enter EAN barcode…"
              maxLength={14}
              className="app-input box-border h-10 w-full px-4 pr-10 text-sm !rounded-[var(--app-radius-lg)]"
            />
            {loading && (
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                <svg className="animate-spin h-4 w-4 text-[var(--app-text-muted)]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={closeScanner}
            aria-label="Cancel barcode scan"
            className="flex-none text-sm font-medium px-3 h-10 rounded-[var(--app-radius-lg)] transition-colors hover:bg-[var(--app-surface-muted)]"
            style={{ color: 'var(--app-text-muted)' }}
          >
            Cancel
          </button>
        </div>
        {displayError && (
          <p className="mt-1.5 px-1 text-xs" style={{ color: 'var(--app-destructive)' }}>{displayError}</p>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={searchInputRef}
        type="text"
        value={searchQuery}
        onChange={(e) => onSearchQueryChange(e.target.value)}
        placeholder="Search foods…"
        className="app-input box-border h-10 min-w-0 flex-1 px-4 text-sm leading-snug !rounded-[var(--app-radius-lg)]"
      />
      <button
        type="button"
        onClick={openScanner}
        aria-label="Scan barcode"
        className="flex h-10 w-10 flex-none items-center justify-center rounded-[var(--app-radius-lg)] transition-colors"
        style={{ background: 'var(--app-surface-muted)' }}
      >
        <BarcodeIcon color="var(--app-text-muted)" />
      </button>
    </div>
  )
}
