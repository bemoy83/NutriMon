import type { ReactNode } from 'react'
import { MacroPills } from '@/components/ui/MacroPills'
import type { MacroChips } from '@/components/ui/MacroPills'

interface FoodRowProps {
  name: string
  subtitle: string
  leading?: ReactNode
  isChecked: boolean
  onTap: () => void
  /** When provided, the checkmark becomes a dedicated remove button and onTap targets only the left content area. */
  onRemove?: () => void
  removeAriaLabel?: string
  macroChips?: MacroChips
}

function CheckmarkCircle() {
  return (
    <div className="flex-none h-8 w-8 flex items-center justify-center rounded-full bg-[var(--app-brand)] text-white">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </div>
  )
}

function ChevronCircle() {
  return (
    <div className="flex-none h-8 w-8 flex items-center justify-center rounded-full border border-transparent bg-[var(--app-input-bg)] text-[var(--app-brand)] transition-[background-color,color,box-shadow] duration-[var(--app-transition-fast)] group-hover:bg-[var(--app-input-bg-focus)] group-hover:text-[var(--app-brand-hover)]">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </div>
  )
}

export default function FoodRow({
  name,
  subtitle,
  leading,
  isChecked,
  onTap,
  onRemove,
  removeAriaLabel,
  macroChips,
}: FoodRowProps) {
  const indicator = isChecked ? <CheckmarkCircle /> : <ChevronCircle />

  if (onRemove) {
    return (
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          className="flex-1 min-w-0 text-left"
          onClick={onTap}
        >
          {leading && <div className="mb-0.5">{leading}</div>}
          <p className="text-sm text-[var(--app-text-primary)] truncate">{name}</p>
          <p className="text-xs text-[var(--app-text-muted)]">{subtitle}</p>
          {macroChips && <MacroPills chips={macroChips} className="mt-1" />}
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeAriaLabel ?? `Remove ${name}`}
          className="transition-opacity hover:opacity-80"
        >
          {indicator}
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={name}
      className="group flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--app-hover-overlay)] active:bg-[var(--app-hover-overlay)] transition-colors"
    >
      {leading && (
        <div className="w-4 h-4 flex-none flex items-center justify-center">
          {leading}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[var(--app-text-primary)] text-sm truncate">{name}</p>
        <p className="text-[var(--app-text-muted)] text-xs">{subtitle}</p>
        {macroChips && <MacroPills chips={macroChips} className="mt-1" />}
      </div>
      {indicator}
    </button>
  )
}
