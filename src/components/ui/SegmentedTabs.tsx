interface Segment<T extends string> {
  label: string
  value: T
}

interface SegmentedTabsProps<T extends string> {
  options: readonly Segment<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

export default function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: SegmentedTabsProps<T>) {
  return (
    <div
      className={`relative z-[1] bg-[var(--app-surface)] px-4 py-3 shadow-[0_4px_14px_-4px_rgb(15_23_42_/_0.1)] ${className}`.trim()}
    >
      <div
        className="flex gap-0.5 rounded-full bg-[var(--app-surface-elevated)] p-0.5"
        role="tablist"
      >
        {options.map((option) => {
          const selected = value === option.value
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(option.value)}
              title={option.label}
              className={`min-w-0 flex-1 truncate rounded-full px-1 py-2 text-xs font-medium transition-[color,background-color] duration-[var(--app-transition-fast)] ease-out ${
                selected
                  ? 'bg-[var(--app-brand)] font-semibold text-white hover:bg-[var(--app-brand-hover)] active:bg-[var(--app-brand-hover)]'
                  : 'text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text-secondary)]'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
