import type { ReactNode } from 'react'

interface MacroChips {
  p?: number | null
  c?: number | null
  f?: number | null
}

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
    <div className="flex-none h-8 w-8 flex items-center justify-center rounded-full bg-[rgb(0_0_0/0.06)] text-[var(--app-text-muted)] border border-[var(--app-border)]">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </div>
  )
}

function MacroPills({ chips }: { chips: MacroChips }) {
  const items = [
    { key: 'p', label: 'P', val: chips.p, color: 'var(--app-macro-protein)', bg: '#EDE9FE' },
    { key: 'c', label: 'C', val: chips.c, color: 'var(--app-macro-carbs)', bg: '#CFFAFE' },
    { key: 'f', label: 'F', val: chips.f, color: 'var(--app-macro-fat)', bg: '#FEF3C7' },
  ].filter((i) => i.val != null && i.val > 0)

  if (items.length === 0) return null

  return (
    <div className="flex gap-1.5 mt-1">
      {items.map(({ key, label, val, color, bg }) => (
        <span
          key={key}
          className="text-[10px] font-bold rounded px-1 py-px"
          style={{ color, background: bg }}
        >
          {label} {Math.round(val!)}g
        </span>
      ))}
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
          {macroChips && <MacroPills chips={macroChips} />}
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
      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--app-hover-overlay)] active:bg-[var(--app-hover-overlay)] transition-colors"
    >
      {leading && (
        <div className="w-4 h-4 flex-none flex items-center justify-center">
          {leading}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[var(--app-text-primary)] text-sm truncate">{name}</p>
        <p className="text-[var(--app-text-muted)] text-xs">{subtitle}</p>
        {macroChips && <MacroPills chips={macroChips} />}
      </div>
      {indicator}
    </button>
  )
}
