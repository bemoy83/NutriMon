import type { CSSProperties, ReactNode } from 'react'

const hudShellClass =
  'w-44 max-sm:min-w-[10.25rem] max-sm:w-auto rounded-xl border border-white/10 bg-[rgba(15,23,42,0.85)] px-3 py-2 shadow-sm max-sm:px-2.5'

export function BattleHudHpBar({
  current,
  max,
  variant,
}: {
  current: number
  max: number
  variant: 'brand' | 'danger'
}) {
  const pct = max > 0 ? Math.round((current / max) * 100) : 0
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--app-border)]">
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{
          width: `${pct}%`,
          background: variant === 'danger' ? 'var(--app-danger)' : 'var(--app-success)',
        }}
      />
    </div>
  )
}

export function BattleHudCard({
  className = '',
  style,
  children,
}: {
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  return (
    <div className={`absolute z-10 ${hudShellClass} ${className}`.trim()} style={style}>
      {children}
    </div>
  )
}
