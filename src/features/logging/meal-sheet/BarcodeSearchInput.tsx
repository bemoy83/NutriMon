interface BarcodeSearchInputProps {
  searchQuery: string
  onSearchQueryChange: (q: string) => void
  onOpenCameraScanner: () => void
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

export default function BarcodeSearchInput({
  searchQuery,
  onSearchQueryChange,
  onOpenCameraScanner,
}: BarcodeSearchInputProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => onSearchQueryChange(e.target.value)}
        placeholder="Search foods…"
        className="app-input box-border h-10 min-w-0 flex-1 px-4 text-sm leading-snug !rounded-[var(--app-radius-lg)]"
      />
      <button
        type="button"
        onClick={onOpenCameraScanner}
        aria-label="Scan barcode"
        className="flex h-10 w-10 flex-none items-center justify-center rounded-[var(--app-radius-lg)] transition-colors"
        style={{ background: 'var(--app-surface-muted)' }}
      >
        <BarcodeIcon color="var(--app-text-muted)" />
      </button>
    </div>
  )
}
