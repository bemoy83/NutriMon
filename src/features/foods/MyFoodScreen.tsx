import { Fragment, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/app/providers/auth'
import { getUserProducts } from '@/features/foods/api'
import LoadingState from '@/components/ui/LoadingState'
import { MacroPills } from '@/components/ui/MacroPills'
import SegmentedTabs from '@/components/ui/SegmentedTabs'
import type { Product } from '@/types/domain'

function formatPer100Grams(n: number): string {
  return n < 10 ? n.toFixed(1) : String(Math.round(n))
}

export default function MyFoodScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'simple' | 'recipe'>('all')

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

  function handleTapProduct(product: Product) {
    navigate(`/app/my-food/${product.id}`)
  }

  if (productsQuery.isLoading) {
    return <LoadingState fullScreen />
  }

  return (
    <div className="app-page min-h-full pb-40">
      {/* Sticky header + filter */}
      <div className="sticky top-0 z-10" style={{ background: 'var(--app-bg)' }}>
        <div className="px-4 pt-6 pb-3">
          <h1 className="text-[32px] font-bold tracking-tight" style={{ color: 'var(--app-text-primary)' }}>
            My Food
          </h1>
        </div>

        <SegmentedTabs
        options={[
          { label: 'All', value: 'all' },
          { label: 'Simple', value: 'simple' },
          { label: 'Recipes', value: 'recipe' },
        ] as const}
        value={filter}
        onChange={setFilter}
        className="!bg-transparent !px-4 !py-0"
      />
      <div className="pb-4" />
      </div>

      <div>

      {/* Empty state — no foods at all */}
      {allProducts.length === 0 ? (
        <div className="py-12 text-center px-4">
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--app-text-primary)' }}>No foods saved yet</p>
          <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>
            Use the search bar below to add your first food
          </p>
        </div>
      ) : search !== '' && filtered.length === 0 ? (
        <div className="py-8 text-center px-4">
          <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>
            No foods match <span style={{ color: 'var(--app-text-primary)' }}>"{search}"</span>
          </p>
        </div>
      ) : (
        <div className="app-card overflow-hidden mx-4">
          {filtered.map((product, idx) => {
            const isComposite = product.kind === 'composite'
            const p = product.proteinPer100g
            const c = product.carbsPer100g
            const f = product.fatPer100g
            const hasMacros = p !== null || c !== null || f !== null

            return (
              <Fragment key={product.id}>
                {idx > 0 && (
                  <div aria-hidden className="mx-4 h-px" style={{ background: 'var(--app-border-muted)' }} />
                )}
                <button
                  type="button"
                  onClick={() => handleTapProduct(product)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[var(--app-hover-overlay)]"
                >
                  <div className="w-8 h-8 flex items-center justify-center shrink-0">
                    {isComposite ? (
                      <svg className="w-5 h-5" style={{ color: 'var(--app-brand)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 6h14M5 10h14M5 14h10" />
                      </svg>
                    ) : (
                      <div className="w-2.5 h-2.5 rounded-full opacity-40" style={{ background: 'var(--app-text-muted)' }} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate mb-0.5" style={{ color: 'var(--app-text-primary)' }}>
                      {product.name}
                    </p>
                    {hasMacros ? (
                      <MacroPills
                        className="mt-0.5"
                        chips={{ p, c, f }}
                        placeholderForNull="—"
                        formatGrams={formatPer100Grams}
                      />
                    ) : (
                      <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>
                        {product.calories} kcal
                        {product.defaultServingAmount && product.defaultServingUnit
                          ? ` / ${product.defaultServingAmount}${product.defaultServingUnit}`
                          : ' / serving'}
                      </p>
                    )}
                  </div>
                  <svg className="w-4 h-4 shrink-0" style={{ color: 'var(--app-text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </Fragment>
            )
          })}
        </div>
      )}
      </div>

      {/* Bottom toolbar: search + new food — floats above nav bar */}
      <div
        className="fixed inset-x-0 bottom-0 z-[19] px-4 pb-[5.5rem] pt-8 pointer-events-none"
        style={{ background: 'linear-gradient(to top, var(--app-bg) 60%, transparent)' }}
      >
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Search pill */}
          <div className="relative flex-1">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              style={{ color: 'var(--app-text-muted)' }}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search foods…"
              className="w-full pl-10 pr-9 py-3 text-sm rounded-full border outline-none transition-[border-color,box-shadow] focus:border-[var(--app-focus)] focus:ring-2 focus:ring-[var(--app-brand-ring)]"
              style={{
                background: 'var(--app-surface)',
                borderColor: 'var(--app-input-border)',
                boxShadow: '0 2px 12px rgb(0 0 0 / 0.08)',
                color: 'var(--app-text-primary)',
              }}
            />
            {search !== '' && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full"
                style={{ color: 'var(--app-text-muted)' }}
                aria-label="Clear search"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* New food button */}
          <button
            type="button"
            onClick={() => navigate('/app/my-food/new')}
            aria-label="New food"
            className="w-12 h-12 flex-none flex items-center justify-center rounded-full text-white transition-colors hover:bg-[var(--app-brand-hover)]"
            style={{
              background: 'var(--app-brand)',
              boxShadow: '0 4px 16px rgb(124 58 237 / 0.35)',
            }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
