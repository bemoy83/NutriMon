import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'

interface GramInputProps {
  grams: number
  onChange: (grams: number) => void
  step?: number
}

export default function GramInput({ grams, onChange, step = 10 }: GramInputProps) {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState('')
  const skipBlurCommitRef = useRef(false)

  function pushParsedGramsFromInput(input: HTMLInputElement) {
    const raw = input.value.replace(/\D/g, '')
    const parsed = parseInt(raw, 10)
    if (!isNaN(parsed) && parsed >= 0) {
      flushSync(() => {
        onChange(parsed)
      })
    }
  }

  function commitFromBlur(e: React.FocusEvent<HTMLInputElement>) {
    if (skipBlurCommitRef.current) {
      skipBlurCommitRef.current = false
      setFocused(false)
      return
    }
    pushParsedGramsFromInput(e.currentTarget)
    setFocused(false)
  }

  function adjust(delta: number) {
    const next = Math.max(0, grams + delta)
    flushSync(() => {
      onChange(next)
    })
    if (focused) {
      setDraft(String(next))
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      pushParsedGramsFromInput(e.currentTarget)
      setFocused(false)
      skipBlurCommitRef.current = true
      e.currentTarget.blur()
    }
    if (e.key === 'Escape') {
      skipBlurCommitRef.current = true
      setDraft(String(Math.round(grams)))
      e.currentTarget.blur()
    }
  }

  const displayValue = focused ? draft : String(Math.round(grams))

  const fieldClass =
    'min-w-0 flex-1 bg-transparent text-right text-sm font-medium tabular-nums text-[var(--app-text-primary)] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

  const shellClass = (active: boolean) =>
    `flex h-[30px] w-16 flex-none items-center justify-center gap-0 rounded-md border py-0.5 pl-1 pr-1 transition-colors ${
      active
        ? 'border-[var(--app-brand)] ring-1 ring-[var(--app-brand)]'
        : 'border-[var(--app-border)] bg-[var(--app-surface)] hover:border-[var(--app-brand)] hover:text-[var(--app-brand)]'
    }`

  const btnClass =
    'h-7 w-7 rounded-full flex items-center justify-center bg-[var(--app-surface-elevated)] text-[var(--app-text-muted)] border border-[var(--app-border)] transition-colors hover:text-[var(--app-text-primary)] hover:bg-[var(--app-border)] text-base leading-none'

  return (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={() => adjust(-step)} className={btnClass} aria-label="Decrease">
        −
      </button>

      <div className={shellClass(focused)}>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          aria-label="Grams"
          value={displayValue}
          onChange={(e) => {
            const next = e.target.value.replace(/\D/g, '')
            setDraft(next)
          }}
          onFocus={(e) => {
            setFocused(true)
            setDraft(String(Math.round(grams)))
            const el = e.currentTarget
            requestAnimationFrame(() => {
              el.select()
            })
          }}
          onBlur={commitFromBlur}
          onKeyDown={handleKeyDown}
          className={fieldClass}
        />
        <span className="pointer-events-none select-none text-sm font-medium tabular-nums text-[var(--app-text-muted)]">g</span>
      </div>

      <button type="button" onClick={() => adjust(step)} className={btnClass} aria-label="Increase">
        +
      </button>
    </div>
  )
}
