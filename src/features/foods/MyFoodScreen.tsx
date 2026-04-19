import { Fragment, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/app/providers/auth'
import { getUserProducts, deleteProduct } from '@/features/foods/api'
import { useInvalidateProductQueries } from '@/features/logging/queryInvalidation'
import type { Product } from '@/types/domain'
import ProductForm from '@/features/logging/ProductForm'
import FoodTypePickerSheet from '@/features/foods/FoodTypePickerSheet'
import CompositeFoodSheet from '@/features/foods/CompositeFoodSheet'
import LoadingState from '@/components/ui/LoadingState'
import BottomSheet from '@/components/ui/BottomSheet'

function fmtMacro(n: number | null): string {
  if (n === null) return '—'
  return n < 10 ? n.toFixed(1) : Math.round(n).toString()
}

export default function MyFoodScreen() {
  const { user } = useAuth()
  const invalidateProducts = useInvalidateProductQueries()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'simple' | 'recipe'>('all')
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

  const allProducts = productsQuery.data ?? []
  const filtered = allProducts.filter((p) => {
    if (filter === 'simple' && p.kind !== 'simple') return false
    if (filter === 'recipe' && p.kind !== 'composite') return false
    return p.name.toLowerCase().includes(search.trim().toLowerCase())
  })

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

  const foodCount = allProducts.length

  return (
    <div className="app-page min-h-full px-4 py-6 pb-24">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--app-text-primary)]">My food</h1>
          {foodCount > 0 && (
            <p className="text-xs text-[var(--app-text-muted)] mt-0.5">
              {foodCount} {foodCount === 1 ? 'food' : 'foods'}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowTypePicker(true)}
          className="app-button-primary px-3 py-2 text-sm"
        >
          + New food
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--app-text-muted)] pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
          />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search foods"
          className="app-input pl-9 pr-8 py-2 text-sm w-full"
        />
        {search !== '' && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] transition-colors"
            aria-label="Clear search"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Filter pills */}
      {allProducts.length > 0 && (
        <div className="flex gap-2 mb-4">
          {(['all', 'simple', 'recipe'] as const).map((f) => {
            const labels = { all: 'All', simple: 'Simple', recipe: 'Recipes' }
            const active = filter === f
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  active
                    ? 'bg-[var(--app-brand)] text-white'
                    : 'bg-[var(--app-surface-elevated)] text-[var(--app-text-muted)] hover:text-[var(--app-text-secondary)]'
                }`}
              >
                {labels[f]}
              </button>
            )
          })}
        </div>
      )}

      {error && <p className="text-[var(--app-danger)] text-xs mb-3">{error}</p>}

      {/* Empty state — no foods at all */}
      {allProducts.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-[var(--app-text-primary)] text-sm font-medium mb-1">No foods saved yet</p>
          <p className="text-[var(--app-text-muted)] text-xs mb-4">
            Add a simple food or build your first recipe
          </p>
          <button
            type="button"
            onClick={() => setShowTypePicker(true)}
            className="app-button-primary px-4 py-2 text-sm"
          >
            Add your first food
          </button>
        </div>
      ) : search !== '' && filtered.length === 0 ? (
        /* Empty state — search no results */
        <div className="py-8 text-center">
          <p className="text-[var(--app-text-muted)] text-sm">
            No foods match{' '}
            <span className="text-[var(--app-text-primary)]">"{search}"</span>
          </p>
        </div>
      ) : (
        /* Grouped list */
        <div className="app-card overflow-hidden">
          {filtered.map((product, idx) => {
            const isComposite = product.kind === 'composite'
            const p = product.proteinPer100g
            const c = product.carbsPer100g
            const f = product.fatPer100g
            const hasMacros = p !== null || c !== null || f !== null

            return (
              <Fragment key={product.id}>
                {idx > 0 && (
                  <div aria-hidden className="mx-4 h-px bg-[var(--app-border-muted)]" />
                )}
                <button
                  type="button"
                  onClick={() => handleTapProduct(product)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[var(--app-hover-overlay)]"
                >
                  {/* Type icon */}
                  <div className="w-8 h-8 flex items-center justify-center shrink-0">
                    {isComposite ? (
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
                          d="M5 6h14M5 10h14M5 14h10"
                        />
                      </svg>
                    ) : (
                      <div className="w-2.5 h-2.5 rounded-full bg-[var(--app-text-muted)] opacity-40" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--app-text-primary)] truncate mb-0.5">
                      {product.name}
                    </p>
                    {hasMacros ? (
                      <p className="text-xs">
                        <span className="text-[var(--app-macro-protein)]">P {fmtMacro(p)}g</span>
                        <span className="text-[var(--app-text-muted)]"> · </span>
                        <span className="text-[var(--app-macro-carbs)]">C {fmtMacro(c)}g</span>
                        <span className="text-[var(--app-text-muted)]"> · </span>
                        <span className="text-[var(--app-macro-fat)]">F {fmtMacro(f)}g</span>
                      </p>
                    ) : (
                      <p className="text-xs text-[var(--app-text-muted)]">
                        {product.calories} kcal
                        {product.defaultServingAmount && product.defaultServingUnit
                          ? ` / ${product.defaultServingAmount}${product.defaultServingUnit}`
                          : ' / serving'}
                      </p>
                    )}
                  </div>

                  {/* Chevron */}
                  <svg
                    className="w-4 h-4 text-[var(--app-text-muted)] shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </Fragment>
            )
          })}
        </div>
      )}

      {/* Type picker sheet */}
      {showTypePicker && (
        <FoodTypePickerSheet
          onClose={() => setShowTypePicker(false)}
          onPickSimple={handlePickSimple}
          onPickComposite={handlePickComposite}
        />
      )}

      {/* Simple food create / edit sheet */}
      {(showSimpleForm || editingProduct) && (
        <BottomSheet
          onClose={() => {
            setShowSimpleForm(false)
            setEditingProduct(null)
          }}
          title={editingProduct ? 'Edit food' : 'New simple food'}
          footer={
            editingProduct ? (
              <button
                type="button"
                disabled={deletingId === editingProduct.id}
                onClick={() => handleDelete(editingProduct)}
                className="app-button-danger w-full py-2.5 text-sm"
              >
                {deletingId === editingProduct.id ? 'Deleting…' : 'Delete food'}
              </button>
            ) : undefined
          }
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

      {/* Composite / recipe sheet */}
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
