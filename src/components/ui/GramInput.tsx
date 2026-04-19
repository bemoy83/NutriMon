import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'

interface GramInputProps {
  grams: number
  onChange: (grams: number) => void
  step?: number
  showSteppers?: boolean
  /** Suffix after the numeric field (default grams). */
  unitSuffix?: string
  /** Overrides the input’s accessible name (defaults from unitSuffix). */
  quantityAriaLabel?: string
}

export default function GramInput({
  grams,
  onChange,
  step = 10,
  showSteppers = true,
  unitSuffix = 'g',
  quantityAriaLabel,
}: GramInputProps) {
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

  const ariaLabel =
    quantityAriaLabel ?? (unitSuffix === 'g' ? 'Grams' : `Amount (${unitSuffix})`)

  const fieldClass =
    'min-w-0 flex-1 bg-transparent text-right text-sm font-medium tabular-nums text-[var(--app-text-primary)] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

  const shellClass = (active: boolean) =>
    `flex h-[30px] min-w-16 w-max max-w-[7rem] flex-none items-center gap-0.5 rounded-md border py-0.5 pl-1 pr-1 transition-colors transition-shadow ${
      active
        ? 'border-[var(--app-focus)] bg-[var(--app-input-bg-focus)] shadow-[var(--app-input-shadow-focus),0_0_0_2px_var(--app-brand-ring)]'
        : 'border-[var(--app-input-border)] bg-[var(--app-input-bg)] shadow-[var(--app-input-shadow)] hover:border-[var(--app-brand)]'
    }`

  const btnClass =
    'h-7 w-7 rounded-full flex items-center justify-center bg-[var(--app-surface-elevated)] text-[var(--app-text-muted)] border border-[var(--app-border)] transition-colors hover:text-[var(--app-text-primary)] hover:bg-[var(--app-border)] text-base leading-none'

  return (
    <div className="flex items-center gap-1.5">
      {showSteppers && (
        <button type="button" onClick={() => adjust(-step)} className={btnClass} aria-label="Decrease">
          −
        </button>
      )}

      <div className={shellClass(focused)}>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          aria-label={ariaLabel}
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
        <span className="pointer-events-none select-none truncate text-sm font-medium tabular-nums text-[var(--app-text-muted)]">
          {unitSuffix}
        </span>
      </div>

      {showSteppers && (
        <button type="button" onClick={() => adjust(step)} className={btnClass} aria-label="Increase">
          +
        </button>
      )}
    </div>
  )
}
