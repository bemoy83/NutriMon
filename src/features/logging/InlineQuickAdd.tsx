import { useState } from 'react'
import { createMealWithItems } from '@/features/logging/api'
import { useInvalidateFoodSourceLists } from '@/features/logging/queryInvalidation'
import type { MealMutationResult } from '@/types/database'
import type { FoodSource } from '@/types/domain'
import { useFrequentFoodSources, useRecentFoodSources } from './useFoodSources'
import FoodSourceBadge from '@/components/ui/FoodSourceBadge'
import EmptyState from '@/components/ui/EmptyState'
import { CardTitle, SectionHeader } from '@/components/ui/AppHeadings'
import { getDefaultMealType } from '@/lib/mealType'

interface Props {
  logDate: string
  loggedAt: string
  onCreated: (result: MealMutationResult) => void
}

function ProductButton({
  product,
  disabled,
  onSelect,
}: {
  product: FoodSource
  disabled: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className="app-card px-3 py-3 text-left transition-colors hover:bg-[var(--app-surface-elevated)] disabled:opacity-50"
    >
      <div className="flex items-center gap-2">
        <p className="text-sm text-[var(--app-text-primary)] truncate">{product.name}</p>
        <FoodSourceBadge sourceType={product.sourceType} />
      </div>
      <p className="mt-1 text-xs text-[var(--app-text-muted)]">{product.calories} kcal</p>
    </button>
  )
}

export default function InlineQuickAdd({ logDate, loggedAt, onCreated }: Props) {
  const recentQuery = useRecentFoodSources()
  const frequentQuery = useFrequentFoodSources()
  const invalidateFoodSources = useInvalidateFoodSourceLists()
  const [addingProductId, setAddingProductId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleQuickAdd(product: FoodSource) {
    setAddingProductId(`${product.sourceType}:${product.sourceId}`)
    setError(null)

    try {
      const result = await createMealWithItems(
        logDate,
        loggedAt,
        [
          {
            ...(product.sourceType === 'user_product'
              ? { product_id: product.sourceId }
              : { catalog_item_id: product.sourceId }),
            quantity: 1,
          },
        ],
        getDefaultMealType(loggedAt),
      )
      invalidateFoodSources()
      onCreated(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add meal')
    } finally {
      setAddingProductId(null)
    }
  }

  const recentProducts: FoodSource[] = (recentQuery.data ?? []).slice(0, 6)
  const frequentProducts: FoodSource[] = (frequentQuery.data ?? []).slice(0, 6)

  return (
    <div className="space-y-4 rounded-2xl border border-[var(--app-border-muted)] bg-[var(--app-surface-muted)] p-4">
      <div>
        <CardTitle>Quick add</CardTitle>
        <p className="mt-1 text-xs text-[var(--app-text-muted)]">Tap a recent or frequent food to log it instantly.</p>
      </div>

      {error && <p className="text-xs text-[var(--app-danger)]">{error}</p>}

      <div className="space-y-3">
        <section>
          <SectionHeader as="h3" className="font-medium tracking-wide">
            Recent
          </SectionHeader>
          {recentProducts.length === 0 ? (
            <EmptyState title="No recent products yet." className="py-2 text-left" />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {recentProducts.map((product: FoodSource) => (
                <ProductButton
                  key={`recent-${product.sourceType}:${product.sourceId}`}
                  product={product}
                  disabled={addingProductId === `${product.sourceType}:${product.sourceId}`}
                  onSelect={() => handleQuickAdd(product)}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionHeader as="h3" className="font-medium tracking-wide">
            Frequent
          </SectionHeader>
          {frequentProducts.length === 0 ? (
            <EmptyState title="No frequent products yet." className="py-2 text-left" />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {frequentProducts.map((product: FoodSource) => (
                <ProductButton
                  key={`frequent-${product.sourceType}:${product.sourceId}`}
                  product={product}
                  disabled={addingProductId === `${product.sourceType}:${product.sourceId}`}
                  onSelect={() => handleQuickAdd(product)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
