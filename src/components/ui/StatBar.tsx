interface StatBarProps {
  label: string
  value: number
  color: string
  /** Scale denominator. Defaults to 100. */
  max?: number
}

export function StatBar({ label, value, color, max = 100 }: StatBarProps) {
  return (
    <div>
      <div className="mb-1 flex justify-between">
        <span className="text-sm text-[var(--app-text-secondary)]">{label}</span>
        <span className="text-sm font-semibold text-[var(--app-text-primary)]">{value}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[var(--app-border)]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min((value / max) * 100, 100)}%`, background: color }}
        />
      </div>
    </div>
  )
}
