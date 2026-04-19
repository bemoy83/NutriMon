import BottomSheet from '@/components/ui/BottomSheet'

interface Props {
  onClose: () => void
  onPickSimple: () => void
  onPickComposite: () => void
}

export default function FoodTypePickerSheet({ onClose, onPickSimple, onPickComposite }: Props) {
  return (
    <BottomSheet onClose={onClose} title="New food">
      <div className="p-4 space-y-3">
        <button
          type="button"
          onClick={onPickSimple}
          className="w-full flex items-center gap-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4 text-left transition-colors hover:bg-[var(--app-hover-overlay)]"
        >
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-[var(--app-surface-elevated)]">
            <svg
              className="w-5 h-5 text-[var(--app-text-muted)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--app-text-primary)]">Simple food</p>
            <p className="text-xs text-[var(--app-text-muted)] mt-0.5">
              Enter calories and macros directly
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={onPickComposite}
          className="w-full flex items-center gap-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4 text-left transition-colors hover:bg-[var(--app-hover-overlay)]"
        >
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-[var(--app-brand-soft)]">
            <svg
              className="w-5 h-5 text-[var(--app-brand)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M6 6h12M6 10h12M6 14h8"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--app-text-primary)]">Recipe / composite</p>
            <p className="text-xs text-[var(--app-text-muted)] mt-0.5">
              Build from ingredients with automatic nutrition rollup
            </p>
          </div>
        </button>
      </div>
    </BottomSheet>
  )
}
