import type { CSSProperties, ReactNode } from 'react'

const hudShellClass =
  'w-44 max-sm:min-w-[10.25rem] max-sm:w-auto rounded-xl border border-white/10 bg-[rgba(10,12,20,0.82)] px-3 py-2 backdrop-blur-lg max-sm:px-2.5'

function hpBarColor(pct: number): string {
  if (pct > 0.5) return 'var(--app-success)'
  if (pct > 0.25) return 'var(--app-warning)'
  return 'var(--app-danger)'
}

export function BattleHudHpBar({
  current,
  max,
}: {
  current: number
  max: number
}) {
  const pct = max > 0 ? current / max : 0
  const isLow = pct <= 0.25
  const color = hpBarColor(pct)

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--app-border)]">
      <div
        className={`h-full rounded-full transition-[width,background-color] duration-700${isLow ? ' animate-hp-shimmer' : ''}`}
        style={{
          width: `${Math.round(pct * 100)}%`,
          background: color,
          boxShadow: isLow ? '0 0 6px 1px var(--app-danger)' : undefined,
        }}
      />
    </div>
  )
}

const FOCUS_PIP_MAX = 3

export function BattleHudFocusPips({ count }: { count: number }) {
  return (
    <div className="mt-2 flex items-center gap-1.5">
      <span className="w-5 text-[10px] font-semibold uppercase tracking-wider text-white/50">FP</span>
      <div className="flex flex-1 gap-1">
        {Array.from({ length: FOCUS_PIP_MAX }).map((_, i) => {
          const filled = i < count
          return (
            <div
              key={i}
              className={`h-2 flex-1 rounded-sm transition-all duration-200 ${
                filled
                  ? 'bg-[var(--app-warning)]'
                  : 'border border-white/10 bg-white/10'
              }`}
              style={filled ? { boxShadow: '0 0 4px rgba(245,158,11,0.55)' } : undefined}
            />
          )
        })}
      </div>
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
    <div
      className={`absolute z-10 ${hudShellClass} ${className}`.trim()}
      style={{
        boxShadow: '0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
