import { Fragment, useDeferredValue, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useAuth } from '@/app/providers/auth'
import { queryKeys } from '@/lib/queryKeys'
import { listUserProductsPage } from '@/features/foods/api'
import LoadingState from '@/components/ui/LoadingState'
import { MacroPills } from '@/components/ui/MacroPills'
import { CardTitle, SectionHeader } from '@/components/ui/AppHeadings'
import FoodSourceBadge from '@/components/ui/FoodSourceBadge'
import SegmentedTabs from '@/components/ui/SegmentedTabs'
import ImportExportSheet from '@/features/foods/ImportExportSheet'
import type { Product } from '@/types/domain'

const PAGE_SIZE = 40

function formatPer100Grams(n: number): string {
  return n < 10 ? n.toFixed(1) : String(Math.round(n))
}

export default function MyFoodScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'simple' | 'recipe'>('all')
  const [showImportExport, setShowImportExport] = useState(false)
  const deferredSearch = useDeferredValue(search)

  const productsQuery = useInfiniteQuery({
    queryKey: queryKeys.myFood.products(user?.id, filter, deferredSearch.trim()),
    enabled: !!user,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      listUserProductsPage({
        userId: user!.id,
        offset: pageParam,
        limit: PAGE_SIZE,
        kind: filter,
        query: deferredSearch,
      }),
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined
      return allPages.length * PAGE_SIZE
    },
  })

  const allProducts = useMemo(
    () => productsQuery.data?.pages.flatMap((p) => p.products) ?? [],
    [productsQuery.data],
  )
  const total = productsQuery.data?.pages[0]?.total ?? 0
  const hasNextPage = productsQuery.hasNextPage
  const fetchNextPage = productsQuery.fetchNextPage
  const isLoading = productsQuery.isPending
  const isFetchNext = productsQuery.isFetching && !productsQuery.isPending

  function handleTapProduct(product: Product) {
    navigate(`/app/my-food/${product.id}`)
  }

  const foodSectionTitle =
    filter === 'all' ? 'Foods' : filter === 'simple' ? 'Simple foods' : 'Recipes'

  /** Total count when not scoped to search (server total for current filter). */
  const isLibraryOverview = filter === 'all' && deferredSearch.trim() === ''
  const isFirstTimeLibrary = isLibraryOverview && total === 0

  if (isLoading) {
    return <LoadingState fullScreen />
  }

  return (
    <div className="app-page min-h-full pb-32">
      <div className="sticky top-0 z-10 px-4 pt-4 pb-3" style={{ background: 'var(--app-bg)' }}>
        <div className="relative z-[1] flex items-start justify-between">
          <div>
            <h1 className="text-[32px] font-bold tracking-tight" style={{ color: 'var(--app-text-primary)' }}>
              My Food
            </h1>
            {isLibraryOverview ? (
              <p className="mt-0.5 text-xs" style={{ color: 'var(--app-text-muted)' }}>
                {total} saved food{total === 1 ? '' : 's'}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setShowImportExport(true)}
            aria-label="Import or export foods"
            className="mt-1 flex h-9 w-9 items-center justify-center rounded-xl transition-colors hover:bg-[var(--app-hover-overlay)]"
            style={{ color: 'var(--app-text-muted)' }}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
            </svg>
          </button>
        </div>

        <div className="relative z-[1] mt-3 app-card border border-[var(--app-border-muted)] overflow-hidden">
          <div className="space-y-3 px-4 pt-3 pb-2">
            <div>
              <CardTitle>Find food</CardTitle>
              <p className="mt-1 text-xs text-[var(--app-text-muted)]">Search and filter your saved foods.</p>
            </div>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search foods…"
                className="app-input box-border h-10 w-full px-4 pr-9 text-sm leading-snug !rounded-[var(--app-radius-lg)]"
              />
              {search !== '' && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-[var(--app-radius-sm)] text-[var(--app-text-muted)] hover:bg-[var(--app-hover-overlay)]"
                  aria-label="Clear search"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <SegmentedTabs
            options={[
              { label: 'All', value: 'all' },
              { label: 'Simple', value: 'simple' },
              { label: 'Recipes', value: 'recipe' },
            ] as const}
            value={filter}
            onChange={setFilter}
            className="!bg-transparent !px-4 !pt-1.5 !pb-3 !shadow-none"
          />
        </div>
        <div
          className="pointer-events-none absolute inset-x-0 top-full h-6"
          style={{
            background: 'linear-gradient(to bottom, var(--app-bg) 0%, transparent 100%)',
          }}
          aria-hidden="true"
        />
      </div>

      <div className="mt-4">

      {/* Empty states */}
      {isFirstTimeLibrary && !isFetchNext ? (
        <div className="py-12 text-center px-4">
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--app-text-primary)' }}>No foods saved yet</p>
          <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>
            Use search to filter, or add a food with the button below
          </p>
        </div>
      ) : allProducts.length === 0 && !isFetchNext ? (
        <div className="py-8 text-center px-4">
          {deferredSearch.trim() ? (
            <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>
              No foods match <span style={{ color: 'var(--app-text-primary)' }}>&quot;{deferredSearch}&quot;</span>
            </p>
          ) : (
            <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>
              {filter === 'simple' ? 'No simple foods yet.' : filter === 'recipe' ? 'No recipes yet.' : 'No foods in this view.'}
            </p>
          )}
        </div>
      ) : (
        <>
          <SectionHeader
            className="mx-4 mb-3"
            trailing={!isLibraryOverview || deferredSearch.trim() !== '' ? allProducts.length : null}
          >
            {foodSectionTitle}
          </SectionHeader>
          <div className="app-card overflow-hidden mx-4">
          {allProducts.map((product, idx) => {
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
                      <svg className="w-5 h-5" style={{ color: 'var(--app-warning)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 6h14M5 10h14M5 14h10" />
                      </svg>
                    ) : (
                      <FoodSourceBadge sourceType="user_product" />
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
          {hasNextPage ? (
            <div className="px-4 py-3">
              <button
                type="button"
                className="w-full rounded-[var(--app-radius-lg)] border border-[var(--app-border-muted)] py-2.5 text-sm font-medium text-[var(--app-text-primary)] transition-colors hover:bg-[var(--app-hover-overlay)] disabled:opacity-50"
                disabled={isFetchNext}
                onClick={() => { void fetchNextPage() }}
              >
                {isFetchNext ? 'Loading…' : 'Load more'}
              </button>
            </div>
          ) : null}
          </div>
        </>
      )}
      </div>

      {/* Add food — full-width CTA above nav (search lives in filter card with tabs) */}
      <div
        className="fixed inset-x-0 bottom-0 z-[19] px-4 pb-[5.5rem] pt-8 pointer-events-none"
        style={{ background: 'linear-gradient(to top, var(--app-bg) 60%, transparent)' }}
      >
        <button
          type="button"
          onClick={() => navigate('/app/my-food/new')}
          className="pointer-events-auto app-button-primary flex w-full items-center justify-center gap-2 !rounded-[var(--app-radius-xl)] py-3.5 text-sm font-semibold shadow-[0_4px_16px_rgb(124_58_237/0.28)]"
        >
          <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add new food
        </button>
      </div>

      {showImportExport && <ImportExportSheet onClose={() => setShowImportExport(false)} />}
    </div>
  )
}
