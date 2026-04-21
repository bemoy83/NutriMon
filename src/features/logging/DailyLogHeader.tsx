import { addDays, formatDisplayDate } from '@/lib/date'

const RING_SIZE = 168
const RING_R = 68
const RING_CX = RING_SIZE / 2
const RING_CY = RING_SIZE / 2
const CIRCUMFERENCE = 2 * Math.PI * RING_R

const COMPACT_RING_SIZE = 52
const COMPACT_RING_R = 20
const COMPACT_RING_CX = COMPACT_RING_SIZE / 2
const COMPACT_RING_CY = COMPACT_RING_SIZE / 2
const COMPACT_CIRCUMFERENCE = 2 * Math.PI * COMPACT_RING_R

const MACRO_TRACK: Record<string, string> = {
  Protein: '#EDE9FE',
  Carbs: '#CFFAFE',
  Fat: '#FEF3C7',
}

type DailyLogHeaderMode = 'dateSticky' | 'fullCard' | 'compactCard'

interface DailyLogHeaderProps {
  logDate: string
  todayDate: string
  isFinalized: boolean
  remaining: number
  consumed: number
  progressPct: number
  currentStreak: number
  totalProteinG: number
  totalCarbsG: number
  totalFatG: number
  proteinTargetG: number
  carbsTargetG: number
  fatTargetG: number
  mode?: DailyLogHeaderMode
  onNavigate: (date: string) => void
}

export default function DailyLogHeader({
  logDate,
  todayDate,
  isFinalized,
  remaining,
  consumed,
  progressPct,
  currentStreak,
  totalProteinG,
  totalCarbsG,
  totalFatG,
  proteinTargetG,
  carbsTargetG,
  fatTargetG,
  mode = 'fullCard',
  onNavigate,
}: DailyLogHeaderProps) {
  const safeConsumed = consumed ?? 0
  const fillLength = CIRCUMFERENCE * Math.min(progressPct / 100, 1)
  const compactFillLength = COMPACT_CIRCUMFERENCE * Math.min(progressPct / 100, 1)
  const over = remaining < 0
  const goalCalories = safeConsumed + remaining

  const ringColor =
    progressPct >= 100
      ? 'var(--app-danger)'
      : progressPct >= 85
        ? 'var(--app-warning)'
        : 'var(--app-brand)'

  if (mode === 'dateSticky') {
    return (
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onNavigate(addDays(logDate, -1))}
          className="rounded-lg p-2 transition-colors text-[var(--app-text-muted)] hover:bg-[var(--app-surface-elevated)] hover:text-[var(--app-text-primary)]"
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
          className="rounded-lg p-2 transition-colors text-[var(--app-text-muted)] hover:bg-[var(--app-surface-elevated)] hover:text-[var(--app-text-primary)] disabled:opacity-30"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <div
      className={`app-card ${mode === 'compactCard' ? 'px-3 py-3' : 'px-4 pt-5 pb-5'}`}
      style={{ borderRadius: 'var(--app-radius-xl)' }}
    >
      {mode === 'compactCard' ? (
        <div className="flex items-center gap-3">
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
                stroke="var(--app-border)"
                strokeWidth={5}
                strokeLinecap="round"
              />
              <circle
                cx={COMPACT_RING_CX}
                cy={COMPACT_RING_CY}
                r={COMPACT_RING_R}
                fill="none"
                stroke={ringColor}
                strokeWidth={5}
                strokeLinecap="round"
                strokeDasharray={`${compactFillLength} ${COMPACT_CIRCUMFERENCE}`}
                style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1), stroke 0.3s ease' }}
              />
            </svg>
          </div>

          <div className="min-w-0 flex-1">
            <p
              className="text-xl font-extrabold leading-none tabular-nums tracking-tight"
              style={{ color: over ? 'var(--app-danger)' : 'var(--app-text-primary)' }}
            >
              {Math.abs(remaining).toLocaleString()}
            </p>
            <p
              className="mt-0.5 text-[9px] font-bold uppercase tracking-wide"
              style={{ color: over ? 'var(--app-danger)' : 'var(--app-text-muted)' }}
            >
              {over ? 'Over goal' : 'Remaining'}
            </p>
            {safeConsumed > 0 ? (
              <p className="mt-0.5 text-[11px] font-semibold tabular-nums" style={{ color: 'var(--app-text-muted)' }}>
                {safeConsumed.toLocaleString()} eaten · goal {goalCalories.toLocaleString()}
              </p>
            ) : (
              <p className="mt-0.5 text-[11px] font-medium" style={{ color: 'var(--app-text-muted)' }}>
                Goal {goalCalories.toLocaleString()} kcal
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-1.5">
            <CompactMacroColumn
              label="P"
              consumed={totalProteinG}
              target={proteinTargetG}
              color="var(--app-macro-protein)"
              trackColor={MACRO_TRACK.Protein}
            />
            <CompactMacroColumn
              label="C"
              consumed={totalCarbsG}
              target={carbsTargetG}
              color="var(--app-macro-carbs)"
              trackColor={MACRO_TRACK.Carbs}
            />
            <CompactMacroColumn
              label="F"
              consumed={totalFatG}
              target={fatTargetG}
              color="var(--app-macro-fat)"
              trackColor={MACRO_TRACK.Fat}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="flex justify-center mb-5">
            <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
              <svg
                width={RING_SIZE}
                height={RING_SIZE}
                style={{ transform: 'rotate(-90deg)', display: 'block' }}
              >
                <circle
                  cx={RING_CX}
                  cy={RING_CY}
                  r={RING_R}
                  fill="none"
                  stroke="var(--app-border)"
                  strokeWidth={14}
                  strokeLinecap="round"
                />
                <circle
                  cx={RING_CX}
                  cy={RING_CY}
                  r={RING_R}
                  fill="none"
                  stroke={ringColor}
                  strokeWidth={14}
                  strokeLinecap="round"
                  strokeDasharray={`${fillLength} ${CIRCUMFERENCE}`}
                  style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1), stroke 0.3s ease' }}
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                <span
                  className="text-[32px] font-extrabold leading-none tabular-nums"
                  style={{
                    color: over ? 'var(--app-danger)' : 'var(--app-text-primary)',
                    letterSpacing: '-1.5px',
                  }}
                >
                  {Math.abs(remaining).toLocaleString()}
                </span>
                <span
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: over ? 'var(--app-danger)' : 'var(--app-text-muted)' }}
                >
                  {over ? 'over goal' : 'remaining'}
                </span>
                {safeConsumed > 0 ? (
                  <div
                    className="mt-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold"
                    style={{ background: 'var(--app-brand-soft)', color: 'var(--app-brand)' }}
                  >
                    🔥 {safeConsumed.toLocaleString()} eaten
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div
            className="flex pt-4 mb-4"
            style={{ borderTop: '1.5px solid var(--app-border-muted)' }}
          >
            {[
              { label: 'Goal', val: goalCalories },
              { label: 'Eaten', val: safeConsumed },
              { label: over ? 'Over' : 'Remaining', val: Math.abs(remaining), danger: over },
            ].map(({ label, val, danger }) => (
              <div key={label} className="flex-1 text-center">
                <p
                  className="text-[10px] font-semibold uppercase tracking-wide mb-1"
                  style={{ color: 'var(--app-text-muted)' }}
                >
                  {label}
                </p>
                <p
                  className="text-[18px] font-extrabold leading-none tabular-nums"
                  style={{ color: danger ? 'var(--app-danger)' : 'var(--app-text-primary)' }}
                >
                  {val.toLocaleString()}
                </p>
              </div>
            ))}
          </div>

          <div
            className="flex gap-3 pt-4"
            style={{ borderTop: '1.5px solid var(--app-border-muted)' }}
          >
            <MacroColumn
              label="Protein"
              consumed={totalProteinG}
              target={proteinTargetG}
              color="var(--app-macro-protein)"
              trackColor={MACRO_TRACK.Protein}
            />
            <MacroColumn
              label="Carbs"
              consumed={totalCarbsG}
              target={carbsTargetG}
              color="var(--app-macro-carbs)"
              trackColor={MACRO_TRACK.Carbs}
            />
            <MacroColumn
              label="Fat"
              consumed={totalFatG}
              target={fatTargetG}
              color="var(--app-macro-fat)"
              trackColor={MACRO_TRACK.Fat}
            />
          </div>
        </>
      )}
    </div>
  )
}

function CompactMacroColumn({
  label,
  consumed,
  target,
  color,
  trackColor,
}: {
  label: string
  consumed: number
  target: number
  color: string
  trackColor: string
}) {
  const pct = target > 0 ? Math.min((consumed / target) * 100, 100) : 0
  const consumedRounded = Math.round(consumed)

  return (
    <div className="w-[46px] min-w-0">
      <div className="flex items-baseline justify-between gap-0.5 mb-0.5">
        <span className="text-[9px] font-bold uppercase" style={{ color: 'var(--app-text-muted)' }}>
          {label}
        </span>
        <span className="text-[9px] font-extrabold tabular-nums truncate" style={{ color }}>
          {consumedRounded}
          <span className="font-semibold" style={{ color: 'var(--app-text-subtle)' }}>
            /{target}
          </span>
        </span>
      </div>
      <div className="h-1 rounded-full overflow-hidden" style={{ background: trackColor }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: color,
            transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
          }}
        />
      </div>
    </div>
  )
}

function MacroColumn({
  label,
  consumed,
  target,
  color,
  trackColor,
}: {
  label: string
  consumed: number
  target: number
  color: string
  trackColor: string
}) {
  const pct = target > 0 ? Math.min((consumed / target) * 100, 100) : 0
  const consumedRounded = Math.round(consumed)

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-baseline justify-between mb-1.5">
        <span
          className="text-[10px] font-bold uppercase tracking-wide"
          style={{ color: 'var(--app-text-muted)' }}
        >
          {label}
        </span>
        <span className="text-[11px] font-extrabold tabular-nums" style={{ color }}>
          {consumedRounded}
          <span className="text-[9px] font-semibold" style={{ color: 'var(--app-text-subtle)' }}>
            /{target}g
          </span>
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: trackColor }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: color,
            transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
          }}
        />
      </div>
    </div>
  )
}
