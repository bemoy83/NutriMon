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
          className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4 text-left"
        >
          <p className="text-sm font-medium text-[var(--app-text-primary)]">Simple food</p>
          <p className="text-xs text-[var(--app-text-muted)] mt-0.5">
            Enter calories and macros directly
          </p>
        </button>
        <button
          type="button"
          onClick={onPickComposite}
          className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4 text-left"
        >
          <p className="text-sm font-medium text-[var(--app-text-primary)]">Recipe / composite</p>
          <p className="text-xs text-[var(--app-text-muted)] mt-0.5">
            Build from ingredients with automatic nutrition rollup
          </p>
        </button>
      </div>
    </BottomSheet>
  )
}
