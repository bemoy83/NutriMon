import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

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
  const pct = max > 0 ? Math.max(0, current / max) : 0
  const isLow = pct <= 0.25
  const color = hpBarColor(pct)

  // Ghost bar — lingers at the previous HP position, then slowly drains.
  const prevPctRef = useRef(pct)
  const [ghostPct, setGhostPct] = useState(pct)
  const [ghostDraining, setGhostDraining] = useState(false)
  const drainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const prev = prevPctRef.current
    prevPctRef.current = pct

    if (pct < prev) {
      // Damage taken — freeze ghost at old position, then drain after a pause.
      setGhostDraining(false)
      if (drainTimerRef.current) clearTimeout(drainTimerRef.current)
      drainTimerRef.current = setTimeout(() => {
        setGhostPct(pct)
        setGhostDraining(true)
      }, 500)
    } else {
      // Heal or no change — snap ghost immediately, no animation.
      if (drainTimerRef.current) clearTimeout(drainTimerRef.current)
      setGhostDraining(false)
      setGhostPct(pct)
    }

    return () => {
      if (drainTimerRef.current) clearTimeout(drainTimerRef.current)
    }
  }, [pct])

  const showGhost = ghostPct > pct

  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-[var(--app-border)]">
      {/* Ghost bar — sits behind the main bar */}
      {showGhost && (
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${Math.round(ghostPct * 100)}%`,
            background: 'rgba(255,255,255,0.35)',
            transition: ghostDraining ? 'width 950ms ease-out' : 'none',
          }}
        />
      )}
      {/* Main HP bar */}
      <div
        className={`absolute inset-y-0 left-0 rounded-full transition-[width,background-color] duration-700${isLow ? ' animate-hp-shimmer' : ''}`}
        style={{
          width: `${Math.round(pct * 100)}%`,
          background: color,
          boxShadow: isLow ? '0 0 6px 1px var(--app-danger)' : undefined,
        }}
      />
      {/* Quarter markers */}
      {[25, 50, 75].map((t) => (
        <div
          key={t}
          className="absolute inset-y-0 w-px bg-black/30"
          style={{ left: `${t}%`, zIndex: 1 }}
        />
      ))}
    </div>
  )
}

const FOCUS_PIP_MAX = 3

export function BattleHudFocusPips({ count }: { count: number }) {
  const atMax = count >= FOCUS_PIP_MAX
  return (
    <div className="mt-2 flex items-center gap-1.5">
      <span
        className="w-5 text-[10px] font-semibold uppercase tracking-wider transition-colors duration-300"
        style={{ color: atMax ? 'var(--app-warning)' : 'rgba(255,255,255,0.4)' }}
      >
        FP
      </span>
      <div className="flex flex-1 gap-1">
        {Array.from({ length: FOCUS_PIP_MAX }).map((_, i) => {
          const filled = i < count
          return (
            <div
              key={`${i}-${filled}`}
              className={`h-2 flex-1 rounded-sm ${filled ? 'animate-pip-fill' : ''} ${filled && atMax ? 'animate-pip-max' : ''}`}
              style={filled
                ? {
                    background: 'var(--app-warning)',
                    boxShadow: atMax
                      ? undefined
                      : '0 0 4px 1px rgba(245,158,11,0.55)',
                  }
                : {
                    background: 'rgba(255,255,255,0.06)',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }
              }
            />
          )
        })}
      </div>
      <span
        className="min-w-[2ch] text-right text-[10px] tabular-nums transition-colors duration-300"
        style={{ color: count > 0 ? 'var(--app-warning)' : 'rgba(255,255,255,0.2)' }}
      >
        {count}/{FOCUS_PIP_MAX}
      </span>
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
