import { addDays, formatDisplayDate } from '@/lib/date'

interface DailyLogHeaderProps {
  logDate: string
  todayDate: string
  isFinalized: boolean
  totalCalories: number
  calorieTarget: number
  remaining: number
  progressPct: number
  currentStreak: number
  onNavigate: (date: string) => void
}

export default function DailyLogHeader({
  logDate,
  todayDate,
  isFinalized,
  totalCalories,
  calorieTarget,
  remaining,
  progressPct,
  currentStreak,
  onNavigate,
}: DailyLogHeaderProps) {
  return (
    <div
      className="sticky top-0 z-10 border-b px-4 pb-3 pt-4 backdrop-blur"
      style={{
        borderColor: 'var(--app-border)',
        background: 'var(--app-nav-bg)',
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onNavigate(addDays(logDate, -1))}
          className="rounded-lg p-2 transition-colors"
          style={{ color: 'var(--app-text-muted)' }}
          onMouseOver={e => {
            ;(e.currentTarget as HTMLButtonElement).style.background =
              'var(--app-surface-elevated)'
            ;(e.currentTarget as HTMLButtonElement).style.color =
              'var(--app-text-primary)'
          }}
          onMouseOut={e => {
            ;(e.currentTarget as HTMLButtonElement).style.background = ''
            ;(e.currentTarget as HTMLButtonElement).style.color =
              'var(--app-text-muted)'
          }}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="text-center">
          <h1
            className="font-semibold"
            style={{ color: 'var(--app-text-primary)' }}
          >
            {formatDisplayDate(logDate)}
          </h1>
          {isFinalized ? (
            <span style={{ color: 'var(--app-success)', fontSize: '0.75rem' }}>
              Finalized
            </span>
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
            ;(e.currentTarget as HTMLButtonElement).style.color =
              'var(--app-text-muted)'
          }}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-2xl font-bold" style={{ color: 'var(--app-text-primary)' }}>
            {totalCalories}
          </p>
          <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>
            consumed
          </p>
        </div>

        {currentStreak > 0 ? (
          <div
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
            style={{
              background: 'var(--app-surface-elevated)',
              border: '1px solid var(--app-border)',
            }}
          >
            <span
              className="text-sm font-semibold"
              style={{ color: 'var(--app-warning)' }}
            >
              {currentStreak}
            </span>
            <span className="text-xs" style={{ color: 'var(--app-text-secondary)' }}>
              day streak
            </span>
          </div>
        ) : null}

        <div className="text-right">
          <p
            className="text-2xl font-bold"
            style={{
              color: remaining < 0 ? 'var(--app-danger)' : 'var(--app-success)',
            }}
          >
            {Math.abs(remaining)}
          </p>
          <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>
            {remaining < 0 ? 'over' : 'remaining'}
          </p>
        </div>
      </div>

      <div
        className="h-2 overflow-hidden rounded-full"
        style={{ background: 'var(--app-border)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${progressPct}%`,
            background:
              progressPct >= 100
                ? 'var(--app-danger)'
                : progressPct >= 85
                  ? 'var(--app-warning)'
                  : 'var(--app-brand)',
          }}
        />
      </div>
      <p className="mt-1 text-right text-xs" style={{ color: 'var(--app-text-subtle)' }}>
        Target: {calorieTarget.toLocaleString()} kcal
      </p>
    </div>
  )
}
