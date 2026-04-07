interface ArenaProgressBarProps {
  defeated: number
  total: number
}

export function ArenaProgressBar({ defeated, total }: ArenaProgressBarProps) {
  const pct = total > 0 ? (defeated / total) * 100 : 0

  return (
    <div>
      <p className="mb-1.5 text-xs text-[var(--app-text-muted)]">
        {defeated} / {total} defeated
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--app-border)]">
        <div
          className="h-full rounded-full bg-[var(--app-brand)] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
