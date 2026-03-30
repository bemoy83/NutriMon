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
    <div className={`flex border-b border-[var(--app-border)] ${className}`.trim()}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
            value === option.value
              ? 'border-b-2 border-[var(--app-focus)] text-[var(--app-brand)]'
              : 'text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)]'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
