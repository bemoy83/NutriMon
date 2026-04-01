import { addDays, formatDisplayDate } from '@/lib/date'

// SVG arc ring constants
const RING_R = 48
const RING_CX = 60
const RING_CY = 60
const CIRCUMFERENCE = 2 * Math.PI * RING_R       // ~301.59
const ARC_LENGTH = CIRCUMFERENCE * 0.75           // 270° arc ~226.19
const GAP_LENGTH = CIRCUMFERENCE - ARC_LENGTH     // 90° gap ~75.40
// rotate(135 cx cy) positions the gap at the bottom-center

interface DailyLogHeaderProps {
  logDate: string
  todayDate: string
  isFinalized: boolean
  remaining: number
  progressPct: number
  currentStreak: number
  totalProteinG: number
  totalCarbsG: number
  totalFatG: number
  proteinTargetG: number
  carbsTargetG: number
  fatTargetG: number
  onNavigate: (date: string) => void
}

export default function DailyLogHeader({
  logDate,
  todayDate,
  isFinalized,
  remaining,
  progressPct,
  currentStreak,
  totalProteinG,
  totalCarbsG,
  totalFatG,
  proteinTargetG,
  carbsTargetG,
  fatTargetG,
  onNavigate,
}: DailyLogHeaderProps) {
  const fillLength = ARC_LENGTH * Math.min(progressPct / 100, 1)
  const ringColor =
    progressPct >= 100
      ? 'var(--app-danger)'
      : progressPct >= 85
        ? 'var(--app-warning)'
        : 'var(--app-brand)'

  return (
    <div
      className="sticky top-0 z-10 border-b backdrop-blur px-4 pt-3 pb-4"
      style={{
        borderColor: 'var(--app-border)',
        background: 'var(--app-nav-bg)',
      }}
    >
      {/* Date navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => onNavigate(addDays(logDate, -1))}
          className="rounded-lg p-2 transition-colors"
          style={{ color: 'var(--app-text-muted)' }}
          onMouseOver={e => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--app-surface-elevated)'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--app-text-primary)'
          }}
          onMouseOut={e => {
            ;(e.currentTarget as HTMLButtonElement).style.background = ''
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--app-text-muted)'
          }}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="text-center">
          <h1 className="font-semibold" style={{ color: 'var(--app-text-primary)' }}>
            {formatDisplayDate(logDate)}
            {currentStreak > 0 && (
              <span className="ml-1.5 text-xs font-medium" style={{ color: 'var(--app-warning)' }}>
                🔥 {currentStreak}
              </span>
            )}
          </h1>
          {isFinalized ? (
            <span className="text-xs" style={{ color: 'var(--app-success)' }}>Finalized</span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => onNavigate(addDays(logDate, 1))}
          disabled={logDate >= todayDate}
          className="rounded-lg p-2 transition-colors disabled:opacity-30"
          style={{ color: 'var(--app-text-muted)' }}
          onMouseOver={e => {
            const btn = e.currentTarget as HTMLButtonElement
            if (!btn.disabled) {
              btn.style.background = 'var(--app-surface-elevated)'
              btn.style.color = 'var(--app-text-primary)'
            }
          }}
          onMouseOut={e => {
            ;(e.currentTarget as HTMLButtonElement).style.background = ''
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--app-text-muted)'
          }}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Ring + Macros row */}
      <div className="flex items-center gap-4">
        {/* Calorie ring */}
        <div className="relative flex-none w-[110px] h-[110px]">
          <svg viewBox="0 0 120 120" className="w-full h-full">
            <g transform={`rotate(135 ${RING_CX} ${RING_CY})`}>
              {/* Track */}
              <circle
                cx={RING_CX}
                cy={RING_CY}
                r={RING_R}
                fill="none"
                stroke="var(--app-border)"
                strokeWidth={10}
                strokeLinecap="round"
                strokeDasharray={`${ARC_LENGTH} ${GAP_LENGTH}`}
              />
              {/* Progress */}
              <circle
                cx={RING_CX}
                cy={RING_CY}
                r={RING_R}
                fill="none"
                stroke={ringColor}
                strokeWidth={10}
                strokeLinecap="round"
                strokeDasharray={`${fillLength} ${CIRCUMFERENCE}`}
                style={{ transition: 'stroke-dasharray 0.5s ease, stroke 0.3s ease' }}
              />
            </g>
          </svg>

          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="text-xl font-bold leading-none"
              style={{ color: progressPct >= 100 ? 'var(--app-danger)' : 'var(--app-text-primary)' }}
            >
              {Math.abs(remaining)}
            </span>
            <span className="text-xs mt-0.5" style={{ color: 'var(--app-text-muted)' }}>
              {remaining < 0 ? 'over' : 'remaining'}
            </span>
          </div>
        </div>

        {/* Macro breakdown */}
        <div className="flex-1 space-y-2.5">
          <MacroBar
            label="Protein"
            consumed={totalProteinG}
            target={proteinTargetG}
            color="var(--app-macro-protein)"
          />
          <MacroBar
            label="Carbs"
            consumed={totalCarbsG}
            target={carbsTargetG}
            color="var(--app-macro-carbs)"
          />
          <MacroBar
            label="Fat"
            consumed={totalFatG}
            target={fatTargetG}
            color="var(--app-macro-fat)"
          />
        </div>
      </div>

    </div>
  )
}

function MacroBar({
  label,
  consumed,
  target,
  color,
}: {
  label: string
  consumed: number
  target: number
  color: string
}) {
  const pct = target > 0 ? Math.min((consumed / target) * 100, 100) : 0
  const consumedRounded = Math.round(consumed)

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs" style={{ color: 'var(--app-text-muted)' }}>
          {label}
        </span>
        <span className="text-xs" style={{ color: 'var(--app-text-secondary)' }}>
          <span style={{ color: 'var(--app-text-primary)', fontWeight: 500 }}>{consumedRounded}</span>
          <span style={{ color: 'var(--app-text-subtle)' }}>/{target}g</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--app-border)' }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: color,
            transition: 'width 0.5s ease',
          }}
        />
      </div>
    </div>
  )
}
