import type { FoodSource } from '@/types/domain'

interface FoodSourceBadgeProps {
  sourceType: FoodSource['sourceType']
}

export default function FoodSourceBadge({ sourceType }: FoodSourceBadgeProps) {
  const isUserProduct = sourceType === 'user_product'

  return (
    <span
      className={`app-badge ${
        isUserProduct
          ? 'bg-[var(--app-surface-elevated)] text-[var(--app-text-secondary)]'
          : 'bg-[var(--app-surface-green)] text-[var(--app-surface-green-text)]'
      }`}
    >
      {isUserProduct ? 'My product' : 'Built-in'}
    </span>
  )
}
