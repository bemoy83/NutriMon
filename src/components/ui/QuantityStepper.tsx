interface QuantityStepperProps {
  quantity: number
  onDecrease: () => void
  onIncrease: () => void
  compact?: boolean
}

export default function QuantityStepper({
  quantity,
  onDecrease,
  onIncrease,
  compact = false,
}: QuantityStepperProps) {
  const buttonSize = compact ? 'h-6 w-6 rounded' : 'h-7 w-7 rounded-full'

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onDecrease}
        className={`${buttonSize} flex items-center justify-center bg-slate-700 text-[var(--app-text-muted)] transition-colors hover:text-white`}
        aria-label="Decrease quantity"
      >
        −
      </button>
      <span className="w-8 text-center text-sm text-white">{quantity}</span>
      <button
        type="button"
        onClick={onIncrease}
        className={`${buttonSize} flex items-center justify-center bg-slate-700 text-[var(--app-text-muted)] transition-colors hover:text-white`}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  )
}
