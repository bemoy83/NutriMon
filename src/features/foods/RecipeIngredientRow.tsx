interface RecipeIngredientRowProps {
  name: string
  massG: number
  kcal: number
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
  onTap: () => void
}

export function RecipeIngredientRow({
  name,
  massG,
  kcal,
  proteinG,
  carbsG,
  fatG,
  onTap,
}: RecipeIngredientRowProps) {
  const hasMacros = proteinG != null || carbsG != null || fatG != null

  return (
    <button
      type="button"
      onClick={onTap}
      className="w-full text-left transition-colors hover:bg-[var(--app-hover-overlay)] active:bg-[var(--app-surface-muted)]"
      aria-label={`Adjust ${name}`}
    >
      <div className="flex items-start justify-between gap-3 px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" style={{ color: 'var(--app-text-primary)' }}>
            {name}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1">
            <span className="text-[11px]" style={{ color: 'var(--app-text-secondary)' }}>
              {massG}g
            </span>
            {hasMacros && (
              <>
                <span className="text-[10px]" style={{ color: 'var(--app-text-subtle)' }}>·</span>
                {proteinG != null && (
                  <span
                    className="rounded px-1 py-px text-[10px] font-bold tabular-nums"
                    style={{ color: 'var(--app-macro-protein)', background: 'var(--app-macro-protein-bg)' }}
                  >
                    P {Math.round(proteinG)}g
                  </span>
                )}
                {carbsG != null && (
                  <span
                    className="rounded px-1 py-px text-[10px] font-bold tabular-nums"
                    style={{ color: 'var(--app-macro-carbs)', background: 'var(--app-macro-carbs-bg)' }}
                  >
                    C {Math.round(carbsG)}g
                  </span>
                )}
                {fatG != null && (
                  <span
                    className="rounded px-1 py-px text-[10px] font-bold tabular-nums"
                    style={{ color: 'var(--app-macro-fat)', background: 'var(--app-macro-fat-bg)' }}
                  >
                    F {Math.round(fatG)}g
                  </span>
                )}
              </>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 pt-0.5">
          <div className="text-right">
            <span
              className="text-[15px] font-extrabold tabular-nums"
              style={{ color: 'var(--app-text-primary)' }}
            >
              {kcal}
            </span>
            <span className="ml-0.5 text-[10px] font-semibold" style={{ color: 'var(--app-text-muted)' }}>
              kcal
            </span>
          </div>
          <svg
            width={12}
            height={12}
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden
            style={{ opacity: 0.3, flexShrink: 0 }}
          >
            <path
              d="M4 2l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </button>
  )
}
