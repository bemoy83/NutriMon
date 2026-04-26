import { addDays, formatDisplayDate } from '@/lib/date'

const COMPACT_RING_SIZE = 58
const COMPACT_RING_R = 26
const COMPACT_RING_CX = COMPACT_RING_SIZE / 2
const COMPACT_RING_CY = COMPACT_RING_SIZE / 2
const COMPACT_CIRCUMFERENCE = 2 * Math.PI * COMPACT_RING_R

const MACRO_TRACK: Record<string, string> = {
  Protein: 'var(--app-macro-protein-bg)',
  Carbs: 'var(--app-macro-carbs-bg)',
  Fat: 'var(--app-macro-fat-bg)',
}

export interface DailyLogDateHeaderProps {
  logDate: string
  todayDate: string
  isFinalized: boolean
  currentStreak: number
  onNavigate: (date: string) => void
}

export interface DailyLogSummaryCardProps {
  remaining: number
  consumed: number
  progressPct: number
  totalProteinG: number
  totalCarbsG: number
  totalFatG: number
  proteinTargetG: number
  carbsTargetG: number
  fatTargetG: number
}

function getSummaryState(consumed: number, remaining: number, progressPct: number) {
  const safeConsumed = consumed ?? 0
  const over = remaining < 0
  const goalCalories = safeConsumed + remaining
  const compactFillLength = COMPACT_CIRCUMFERENCE * Math.min(progressPct / 100, 1)
  const ringColor =
    progressPct >= 100
      ? 'var(--app-danger)'
      : progressPct >= 85
        ? 'var(--app-warning)'
        : 'var(--app-brand)'

  return {
    compactFillLength,
    goalCalories,
    over,
    ringColor,
    safeConsumed,
  }
}

export function DailyLogDateHeader({
  logDate,
  todayDate,
  isFinalized,
  currentStreak,
  onNavigate,
}: DailyLogDateHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <button
        type="button"
        onClick={() => onNavigate(addDays(logDate, -1))}
        className="rounded-[var(--app-radius-md)] p-2 transition-colors text-[var(--app-text-muted)] hover:bg-[var(--app-surface-elevated)] hover:text-[var(--app-text-primary)]"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div className="text-center">
        <h1 className="font-semibold" style={{ color: 'var(--app-text-primary)' }}>
          {formatDisplayDate(logDate)}
          {currentStreak > 0 ? (
            <span className="ml-1.5 text-xs font-medium" style={{ color: 'var(--app-warning)' }}>
              🔥 {currentStreak}
            </span>
          ) : null}
        </h1>
        {isFinalized ? (
          <span className="text-xs" style={{ color: 'var(--app-success)' }}>Finalized</span>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => onNavigate(addDays(logDate, 1))}
        disabled={logDate >= todayDate}
        className="rounded-[var(--app-radius-md)] p-2 transition-colors text-[var(--app-text-muted)] hover:bg-[var(--app-surface-elevated)] hover:text-[var(--app-text-primary)] disabled:opacity-30"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  )
}

export function DailyLogCompactCard({
  remaining,
  consumed,
  progressPct,
  totalProteinG,
  totalCarbsG,
  totalFatG,
  proteinTargetG,
  carbsTargetG,
  fatTargetG,
}: DailyLogSummaryCardProps) {
  const {
    compactFillLength,
    goalCalories,
    over,
    ringColor,
    safeConsumed,
  } = getSummaryState(consumed, remaining, progressPct)

  const macroRows = [
    { label: 'P', val: totalProteinG, target: proteinTargetG, color: 'var(--app-macro-protein)', bg: MACRO_TRACK.Protein },
    { label: 'C', val: totalCarbsG,   target: carbsTargetG,   color: 'var(--app-macro-carbs)',   bg: MACRO_TRACK.Carbs },
    { label: 'F', val: totalFatG,     target: fatTargetG,     color: 'var(--app-macro-fat)',     bg: MACRO_TRACK.Fat },
  ]

  return (
    <div className="app-card rounded-[var(--app-radius-xl)] px-4 py-3.5">
      <div className="flex items-center gap-3.5">
        {/* Mini ring with remaining inside */}
        <div className="relative shrink-0" style={{ width: COMPACT_RING_SIZE, height: COMPACT_RING_SIZE }}>
          <svg
            width={COMPACT_RING_SIZE}
            height={COMPACT_RING_SIZE}
            style={{ transform: 'rotate(-90deg)', display: 'block' }}
          >
            <circle
              cx={COMPACT_RING_CX}
              cy={COMPACT_RING_CY}
              r={COMPACT_RING_R}
              fill="none"
              stroke="var(--app-ring-track)"
              strokeWidth={6}
              strokeLinecap="round"
            />
            <circle
              cx={COMPACT_RING_CX}
              cy={COMPACT_RING_CY}
              r={COMPACT_RING_R}
              fill="none"
              stroke={ringColor}
              strokeWidth={6}
              strokeLinecap="round"
              strokeDasharray={`${compactFillLength} ${COMPACT_CIRCUMFERENCE}`}
              style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1), stroke 0.3s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="text-[13px] font-extrabold leading-none tabular-nums"
              style={{ color: over ? 'var(--app-danger)' : 'var(--app-text-primary)', letterSpacing: '-0.5px' }}
            >
              {Math.abs(remaining).toLocaleString()}
            </span>
            <span
              className="text-[8px] font-semibold uppercase tracking-wide mt-0.5"
              style={{ color: over ? 'var(--app-danger)' : 'var(--app-text-muted)' }}
            >
              {over ? 'over' : 'left'}
            </span>
          </div>
        </div>

        {/* Macro bars: P / C / F rows */}
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          {macroRows.map(({ label, val, target, color, bg }) => {
            const pct = target > 0 ? Math.min((val / target) * 100, 100) : 0
            return (
              <div key={label} className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold w-2.5 shrink-0" style={{ color }}>{label}</span>
                <div className="flex-1 h-[5px] rounded-full overflow-hidden" style={{ background: bg }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: color, transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1)' }}
                  />
                </div>
                <span className="text-[10px] font-bold tabular-nums shrink-0 text-right" style={{ width: 42, color: 'var(--app-text-secondary)' }}>
                  {Math.round(val)}<span style={{ color: 'var(--app-text-subtle)' }}>/{target}g</span>
                </span>
              </div>
            )
          })}
        </div>

        {/* Kcal eaten */}
        <div className="text-right shrink-0">
          <div
            className="text-[20px] font-extrabold leading-none tabular-nums"
            style={{ color: 'var(--app-text-primary)', letterSpacing: '-0.5px' }}
          >
            {safeConsumed.toLocaleString()}
          </div>
          <div
            className="text-[9px] font-semibold uppercase tracking-wide mt-0.5"
            style={{ color: 'var(--app-text-muted)' }}
          >
            of {goalCalories.toLocaleString()} kcal
          </div>
        </div>
      </div>
    </div>
  )
}
