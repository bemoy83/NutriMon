import type { FoodSource } from '@/types/domain'

interface FoodSourceBadgeProps {
  sourceType: FoodSource['sourceType']
}

export default function FoodSourceBadge({ sourceType }: FoodSourceBadgeProps) {
  const isUserProduct = sourceType === 'user_product'

  return (
    <span
      className="inline-block w-2 h-2 rounded-full flex-none"
      style={{ background: isUserProduct ? 'var(--app-warning)' : 'var(--app-brand)' }}
      title={isUserProduct ? 'My product' : 'Built-in'}
    />
  )
}
