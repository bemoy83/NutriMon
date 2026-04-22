export interface MacroChips {
  p?: number | null
  c?: number | null
  f?: number | null
}

const ROW = [
  { key: 'p', label: 'P', color: 'var(--app-macro-protein)', bg: 'var(--app-macro-protein-bg)' },
  { key: 'c', label: 'C', color: 'var(--app-macro-carbs)', bg: 'var(--app-macro-carbs-bg)' },
  { key: 'f', label: 'F', color: 'var(--app-macro-fat)', bg: 'var(--app-macro-fat-bg)' },
] as const

export function MacroPills({
  chips,
  className,
  /** When true, render a pill for each macro with a defined value (including 0). When false, omit macros ≤ 0. */
  showZeroValues = false,
  /** When set, always render P/C/F; use this string in place of a null gram value (e.g. per-100g unknown). */
  placeholderForNull,
  formatGrams = (n: number) => String(Math.round(n)),
}: {
  chips: MacroChips
  className?: string
  showZeroValues?: boolean
  placeholderForNull?: string
  formatGrams?: (n: number) => string
}) {
  const items = ROW.flatMap((row) => {
    const val = chips[row.key]
    if (placeholderForNull != null) {
      return [
        {
          key: row.key,
          label: row.label,
          color: row.color,
          bg: row.bg,
          body: val == null ? placeholderForNull : formatGrams(val),
        },
      ]
    }
    if (val == null) return []
    if (showZeroValues) {
      if (val < 0) return []
    } else if (val <= 0) return []
    return [{ key: row.key, label: row.label, color: row.color, bg: row.bg, body: formatGrams(val) }]
  })

  if (items.length === 0) return null

  const rootClass = ['flex flex-wrap items-center gap-1.5', className].filter(Boolean).join(' ')

  return (
    <div className={rootClass}>
      {items.map(({ key, label, color, bg, body }) => (
        <span
          key={key}
          className="text-[10px] font-bold rounded px-1 py-px tabular-nums"
          style={{ color, background: bg }}
        >
          {label} {body}g
        </span>
      ))}
    </div>
  )
}
