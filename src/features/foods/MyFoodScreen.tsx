import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/app/providers/auth'
import { getUserProducts, deleteProduct } from '@/features/foods/api'
import { useInvalidateProductQueries } from '@/features/logging/queryInvalidation'
import type { Product } from '@/types/domain'
import ProductForm from '@/features/logging/ProductForm'
import FoodTypePickerSheet from '@/features/foods/FoodTypePickerSheet'
import CompositeFoodSheet from '@/features/foods/CompositeFoodSheet'
import LoadingState from '@/components/ui/LoadingState'
import EmptyState from '@/components/ui/EmptyState'
import BottomSheet from '@/components/ui/BottomSheet'

export default function MyFoodScreen() {
  const { user } = useAuth()
  const invalidateProducts = useInvalidateProductQueries()
  const [search, setSearch] = useState('')
  const [showTypePicker, setShowTypePicker] = useState(false)
  const [showSimpleForm, setShowSimpleForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [compositeSheetProductId, setCompositeSheetProductId] = useState<string | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const productsQuery = useQuery({
    queryKey: ['my-food-products', user?.id],
    enabled: !!user,
    queryFn: () => getUserProducts(user!.id),
  })

  const filtered = (productsQuery.data ?? []).filter((p) =>
    p.name.toLowerCase().includes(search.trim().toLowerCase()),
  )

  async function handleDelete(product: Product) {
    if (!window.confirm(`Delete "${product.name}"? Logged meals will keep their historical snapshots.`)) {
      return
    }

    setDeletingId(product.id)
    setError(null)

    try {
      await deleteProduct(product.id)
      invalidateProducts()
      if (editingProduct?.id === product.id) setEditingProduct(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product')
    } finally {
      setDeletingId(null)
    }
  }

  function handlePickSimple() {
    setShowTypePicker(false)
    setEditingProduct(null)
    setShowSimpleForm(true)
  }

  function handlePickComposite() {
    setShowTypePicker(false)
    setCompositeSheetProductId(null)
  }

  function handleTapProduct(product: Product) {
    if (product.kind === 'composite') {
      setCompositeSheetProductId(product.id)
      return
    }
    setShowSimpleForm(false)
    setEditingProduct(product)
  }

  if (productsQuery.isLoading) {
    return <LoadingState fullScreen />
  }

  return (
    <div className="app-page min-h-full px-4 py-6 pb-24">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-[var(--app-text-primary)]">My food</h1>
        <button
          type="button"
          onClick={() => setShowTypePicker(true)}
          className="app-button-primary px-3 py-2 text-sm"
        >
          New food
        </button>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search foods"
        className="app-input px-3 py-2 text-sm mb-4 w-full"
      />

      {error && <p className="text-[var(--app-danger)] text-xs mb-3">{error}</p>}

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <EmptyState title="No matching foods." className="py-4" />
        ) : (
          filtered.map((product) => (
            <div
              key={product.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-3"
            >
              <button
                type="button"
                onClick={() => handleTapProduct(product)}
                className="min-w-0 text-left flex-1"
              >
                <div className="flex items-center gap-2">
                  <p className="text-[var(--app-text-primary)] text-sm truncate">{product.name}</p>
                  {product.kind === 'composite' && (
                    <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--app-text-muted)] bg-[var(--app-border)] rounded px-1.5 py-0.5 shrink-0">
                      Recipe
                    </span>
                  )}
                </div>
                <p className="text-[var(--app-text-muted)] text-xs">
                  {product.calories} kcal
                  {product.defaultServingAmount && product.defaultServingUnit
                    ? ` / ${product.defaultServingAmount}${product.defaultServingUnit}`
                    : ' / serving'}
                  {product.useCount > 0 ? ` · used ${product.useCount}x` : ''}
                </p>
              </button>
              <button
                type="button"
                disabled={deletingId === product.id}
                onClick={() => handleDelete(product)}
                className="app-button-danger px-3 py-1.5 text-xs shrink-0"
              >
                {deletingId === product.id ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          ))
        )}
      </div>

      {showTypePicker && (
        <FoodTypePickerSheet
          onClose={() => setShowTypePicker(false)}
          onPickSimple={handlePickSimple}
          onPickComposite={handlePickComposite}
        />
      )}

      {(showSimpleForm || editingProduct) && (
        <BottomSheet
          onClose={() => {
            setShowSimpleForm(false)
            setEditingProduct(null)
          }}
          title={editingProduct ? 'Edit food' : 'New simple food'}
        >
          <ProductForm
            initialProduct={editingProduct}
            onSave={() => {
              invalidateProducts()
              setShowSimpleForm(false)
              setEditingProduct(null)
            }}
            onCancel={() => {
              setShowSimpleForm(false)
              setEditingProduct(null)
            }}
          />
        </BottomSheet>
      )}

      {compositeSheetProductId !== undefined && (
        <CompositeFoodSheet
          editProductId={compositeSheetProductId}
          onClose={() => setCompositeSheetProductId(undefined)}
          onSaved={() => {
            invalidateProducts()
            setCompositeSheetProductId(undefined)
          }}
        />
      )}
    </div>
  )
}
