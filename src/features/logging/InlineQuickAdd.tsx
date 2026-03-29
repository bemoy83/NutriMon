import { useState } from 'react'
import { createMealWithItems } from '@/features/logging/api'
import { useFrequentProducts, useInvalidateProducts, useRecentProducts } from '@/features/logging/useProducts'
import type { MealMutationResult } from '@/types/database'
import type { Product } from '@/types/domain'

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
  product: Product
  disabled: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-left transition-colors hover:bg-slate-700 disabled:opacity-50"
    >
      <p className="text-sm text-white truncate">{product.name}</p>
      <p className="mt-1 text-xs text-slate-400">{product.calories} kcal</p>
    </button>
  )
}

export default function InlineQuickAdd({ logDate, loggedAt, onCreated }: Props) {
  const recentQuery = useRecentProducts()
  const frequentQuery = useFrequentProducts()
  const invalidateProducts = useInvalidateProducts()
  const [addingProductId, setAddingProductId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleQuickAdd(product: Product) {
    setAddingProductId(product.id)
    setError(null)

    try {
      const result = await createMealWithItems(logDate, loggedAt, [
        { product_id: product.id, quantity: 1 },
      ])
      invalidateProducts()
      onCreated(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add meal')
    } finally {
      setAddingProductId(null)
    }
  }

  const recentProducts = (recentQuery.data ?? []).slice(0, 6)
  const frequentProducts = (frequentQuery.data ?? []).slice(0, 6)

  return (
    <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <div>
        <h2 className="text-sm font-semibold text-white">Quick add</h2>
        <p className="mt-1 text-xs text-slate-400">Tap a recent or frequent product to log it instantly.</p>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="space-y-3">
        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Recent</h3>
          {recentProducts.length === 0 ? (
            <p className="text-sm text-slate-500">No recent products yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {recentProducts.map((product) => (
                <ProductButton
                  key={`recent-${product.id}`}
                  product={product}
                  disabled={addingProductId === product.id}
                  onSelect={() => handleQuickAdd(product)}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Frequent</h3>
          {frequentProducts.length === 0 ? (
            <p className="text-sm text-slate-500">No frequent products yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {frequentProducts.map((product) => (
                <ProductButton
                  key={`frequent-${product.id}`}
                  product={product}
                  disabled={addingProductId === product.id}
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
