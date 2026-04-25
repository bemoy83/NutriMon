export interface ServingEstimateBlockProps {
  kcal: number
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
  /** Section label (default matches meal serving step). */
  eyebrow?: string
  /** When false, omit the eyebrow line (e.g. parent already has a section title). */
  showEyebrow?: boolean
  /** Supporting line next to the large kcal readout. */
  description?: string
  /** When false, omit bottom border (e.g. last block in a card). */
  showBottomBorder?: boolean
  /** `cards` = colored macro tiles; `inline` = one compact P/C/F line (saves space). */
  macros?: 'cards' | 'inline'
}

export default function ServingEstimateBlock({
  kcal,
  proteinG,
  carbsG,
  fatG,
  eyebrow = 'Estimate',
  showEyebrow = true,
  description = 'Nutrition for this serving',
  showBottomBorder = true,
  macros = 'cards',
}: ServingEstimateBlockProps) {
  const compactHero = macros === 'inline'
  const hasMacros = proteinG != null || carbsG != null || fatG != null
  const macroRows = [
    { label: 'Protein', shortLabel: 'P', value: proteinG, color: 'var(--app-macro-protein)', bg: 'var(--app-macro-protein-bg)' },
    { label: 'Carbs', shortLabel: 'C', value: carbsG, color: 'var(--app-macro-carbs)', bg: 'var(--app-macro-carbs-bg)' },
    { label: 'Fat', shortLabel: 'F', value: fatG, color: 'var(--app-macro-fat)', bg: 'var(--app-macro-fat-bg)' },
  ]

  const padBottom = showBottomBorder
    ? macros === 'inline'
      ? 'pb-3'
      : 'pb-5'
    : macros === 'inline'
      ? 'pb-0'
      : 'pb-5'

  return (
    <section
      className={[showBottomBorder ? 'border-b border-[var(--app-border-muted)]' : '', padBottom].filter(Boolean).join(' ')}
    >
      {showEyebrow ? (
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--app-text-subtle)]">
          {eyebrow}
        </p>
      ) : null}
      <div
        className={`flex justify-between gap-3 ${compactHero ? 'items-center' : 'items-end'} ${showEyebrow ? 'mt-2' : ''}`}
      >
        <p
          className={
            compactHero
              ? 'max-w-[min(11rem,55%)] text-xs leading-snug text-[var(--app-text-muted)]'
              : 'max-w-[11rem] text-sm leading-5 text-[var(--app-text-muted)]'
          }
        >
          {description}
        </p>
        {compactHero ? (
          <div className="flex shrink-0 items-baseline gap-1.5 text-right">
            <p className="text-2xl font-bold leading-none tabular-nums text-[var(--app-text-primary)]">{kcal}</p>
            <p className="text-[10px] font-medium text-[var(--app-text-muted)]">kcal</p>
          </div>
        ) : (
          <div className="text-right">
            <p className="text-5xl font-bold leading-none tabular-nums text-[var(--app-text-primary)]">{kcal}</p>
            <p className="mt-1 text-xs font-medium text-[var(--app-text-muted)]">kcal</p>
          </div>
        )}
      </div>
      {hasMacros && macros === 'inline' ? (
        <p
          className="mt-1 text-xs tabular-nums text-[var(--app-text-muted)]"
          aria-label={`Protein ${proteinG == null ? 'unknown' : `${Math.round(proteinG)} grams`}, Carbs ${carbsG == null ? 'unknown' : `${Math.round(carbsG)} grams`}, Fat ${fatG == null ? 'unknown' : `${Math.round(fatG)} grams`}`}
        >
          <span style={{ color: 'var(--app-macro-protein)' }}>P</span>{' '}
          {proteinG == null ? '—' : `${Math.round(proteinG)}g`}
          <span className="text-[var(--app-text-subtle)]"> · </span>
          <span style={{ color: 'var(--app-macro-carbs)' }}>C</span>{' '}
          {carbsG == null ? '—' : `${Math.round(carbsG)}g`}
          <span className="text-[var(--app-text-subtle)]"> · </span>
          <span style={{ color: 'var(--app-macro-fat)' }}>F</span>{' '}
          {fatG == null ? '—' : `${Math.round(fatG)}g`}
        </p>
      ) : null}
      {hasMacros && macros === 'cards' ? (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {macroRows.map((macro) => (
            <div
              key={macro.shortLabel}
              className="rounded-xl px-2 py-2 text-center"
              style={{ background: macro.bg }}
              aria-label={`${macro.label} ${macro.value == null ? 'unknown' : `${Math.round(macro.value)} grams`}`}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: macro.color }}>
                {macro.shortLabel}
              </p>
              <p className="mt-0.5 text-sm font-bold tabular-nums" style={{ color: macro.color }}>
                {macro.value == null ? '—' : `${Math.round(macro.value)}g`}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}
