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
      className={`relative z-[1] bg-white px-4 py-2 ${className}`.trim()}
    >
      <div
        className="flex gap-0.5 rounded-full bg-[var(--app-input-bg)] p-0.5"
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
              className={`min-w-0 flex-1 truncate rounded-full px-1 py-1.5 text-xs font-medium outline-none transition-[color,background-color,box-shadow] duration-[var(--app-transition-fast)] ease-out focus-visible:shadow-[0_0_0_3px_var(--app-brand-ring),var(--app-input-shadow-focus)] ${
                selected
                  ? 'bg-white font-semibold text-[var(--app-brand)] shadow-[0_1px_8px_rgb(124_58_237/0.10)] hover:bg-[var(--app-input-bg-focus)] active:bg-[var(--app-input-bg-focus)]'
                  : 'text-[var(--app-input-placeholder)] hover:bg-white/55 hover:text-[var(--app-text-secondary)] active:bg-white/70'
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
