import { useRef, useState } from 'react'

interface GramInputProps {
  grams: number
  onChange: (grams: number) => void
  step?: number
}

export default function GramInput({ grams, onChange, step = 25 }: GramInputProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function startEditing() {
    setDraft(String(Math.round(grams)))
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  function commit() {
    const parsed = parseInt(draft, 10)
    if (!isNaN(parsed) && parsed >= 0) {
      onChange(parsed)
    }
    setEditing(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') commit()
    if (e.key === 'Escape') setEditing(false)
  }

  const btnClass =
    'h-7 w-7 rounded-full flex items-center justify-center bg-[var(--app-surface-elevated)] text-[var(--app-text-muted)] border border-[var(--app-border)] transition-colors hover:text-[var(--app-text-primary)] hover:bg-[var(--app-border)] text-base leading-none'

  return (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={() => onChange(Math.max(0, grams - step))} className={btnClass} aria-label="Decrease">
        −
      </button>

      {editing ? (
        <input
          ref={inputRef}
          type="number"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className="w-16 text-center text-sm font-medium rounded-md border border-[var(--app-brand)] bg-[var(--app-surface)] text-[var(--app-text-primary)] py-0.5 outline-none focus:ring-1 focus:ring-[var(--app-brand)]"
          inputMode="numeric"
        />
      ) : (
        <button
          type="button"
          onClick={startEditing}
          className="w-16 text-center text-sm font-medium text-[var(--app-text-primary)] rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] py-0.5 transition-colors hover:border-[var(--app-brand)] hover:text-[var(--app-brand)]"
        >
          {Math.round(grams)}g
        </button>
      )}

      <button type="button" onClick={() => onChange(grams + step)} className={btnClass} aria-label="Increase">
        +
      </button>
    </div>
  )
}
