import { Fragment, useMemo, type ReactNode } from 'react'
import type { FoodSource, MealTemplate } from '@/types/domain'
import FoodRow from '@/components/ui/FoodRow'
import FoodSourceBadge from '@/components/ui/FoodSourceBadge'
import SegmentedTabs from '@/components/ui/SegmentedTabs'
import {
  getItemKey,
  getItemKcal,
  getItemLabel,
  getItemSourceType,
} from '../itemHelpers'
import type { Item } from '../types'
import { MealTemplateRow } from './MealTemplateRow'
import BarcodeSearchInput from './BarcodeSearchInput'
import type { KassalappProduct } from '@/lib/kassalapp'

function InsetRowDivider() {
  return <div aria-hidden className="mx-4 h-px bg-[var(--app-border-muted)]" />
}

export interface MealSheetBrowseViewProps {
  searchQuery: string
  onSearchQueryChange: (q: string) => void
  tab: 'recent' | 'saved' | 'pending'
  onTabChange: (t: 'recent' | 'saved' | 'pending') => void
  items: Item[]
  isSearching: boolean
  deferredSearchQuery: string
  searchResults: { data?: FoodSource[]; isPending: boolean }
  activeFoodSources: FoodSource[]
  visibleTemplates: MealTemplate[]
  submitting: boolean
  isItemPending: (fs: FoodSource) => boolean
  onFoodTap: (fs: FoodSource) => void
  getPendingItemServingLabel: (item: Item) => string
  onLogTemplate: (t: MealTemplate) => void
  onDeleteTemplate: (id: string) => void
  onOpenCreateFood: () => void
  onBarcodeProduct: (product: KassalappProduct) => void
  footer: ReactNode
}

export default function MealSheetBrowseView({
  searchQuery,
  onSearchQueryChange,
  tab,
  onTabChange,
  items,
  isSearching,
  deferredSearchQuery,
  searchResults,
  activeFoodSources,
  visibleTemplates,
  submitting,
  isItemPending,
  onFoodTap,
  getPendingItemServingLabel,
  onLogTemplate,
  onDeleteTemplate,
  onOpenCreateFood,
  onBarcodeProduct,
  footer,
}: MealSheetBrowseViewProps) {
  const tabOptions = useMemo(
    () =>
      [
        { value: 'recent' as const, label: 'Recent' },
        { value: 'saved' as const, label: 'Saved' },
        {
          value: 'pending' as const,
          label: items.length > 0 ? `Pending · ${items.length}` : 'Pending',
        },
      ] as const,
    [items.length],
  )

  return (
    <>
      <div className="flex-none px-4 py-2 bg-white">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Search foods…"
            className="app-input box-border h-10 min-w-0 flex-1 px-4 text-sm leading-snug !rounded-[var(--app-radius-lg)]"
          />
          <BarcodeSearchInput onProduct={onBarcodeProduct} />
        </div>
      </div>

      <SegmentedTabs<'recent' | 'saved' | 'pending'>
        value={tab}
        options={[...tabOptions]}
        onChange={onTabChange}
        className="!bg-white !shadow-none !pt-1.5 !pb-3 !border-b !border-[var(--app-border-muted)]"
      />

      {isSearching && tab === 'recent' && searchResults.isPending && (
        <div className="px-4 py-3 text-sm text-[var(--app-text-muted)]">Searching…</div>
      )}

      <div className="flex-1 overflow-y-auto">
        {tab === 'pending' ? (
          items.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-[var(--app-text-muted)]">No items added yet.</p>
              <p className="mt-1 text-xs text-[var(--app-text-subtle)]">Tap a food from Recent to get started.</p>
            </div>
          ) : (
            items.map((item, idx) => (
              <Fragment key={getItemKey(item)}>
                {idx > 0 && <InsetRowDivider />}
                <FoodRow
                  name={getItemLabel(item)}
                  subtitle={`${getItemKcal(item)} kcal · ${getPendingItemServingLabel(item)}`}
                  leading={
                    item.foodSource?.kind === 'composite' ? (
                      <svg className="w-4 h-4 text-[var(--app-warning)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 6h14M5 10h14M5 14h10" />
                      </svg>
                    ) : (
                      <FoodSourceBadge sourceType={getItemSourceType(item) ?? 'user_product'} />
                    )
                  }
                  isChecked
                  onTap={() => item.foodSource && onFoodTap(item.foodSource)}
                  macroChips={
                    item.snapshotProteinG != null || item.snapshotCarbsG != null || item.snapshotFatG != null
                      ? { p: item.snapshotProteinG, c: item.snapshotCarbsG, f: item.snapshotFatG }
                      : undefined
                  }
                />
              </Fragment>
            ))
          )
        ) : tab === 'saved' ? (
          visibleTemplates.length === 0 ? (
            <div className="px-4 py-8 text-center">
              {isSearching ? (
                <p className="text-sm text-[var(--app-text-muted)]">No saved meals match &ldquo;{deferredSearchQuery.trim()}&rdquo;</p>
              ) : (
                <>
                  <p className="text-sm text-[var(--app-text-muted)]">No saved meals yet.</p>
                  <p className="mt-1 text-xs text-[var(--app-text-subtle)]">
                    Save a meal from the meal card to reuse it here.
                  </p>
                </>
              )}
            </div>
          ) : (
            visibleTemplates.map((template) => (
              <MealTemplateRow
                key={template.id}
                template={template}
                loading={submitting}
                onLog={() => onLogTemplate(template)}
                onDelete={() => onDeleteTemplate(template.id)}
              />
            ))
          )
        ) : (
          <>
            {isSearching && !searchResults.isPending && (searchResults.data?.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center py-8 gap-3">
                <p className="text-sm text-[var(--app-text-muted)]">No foods found</p>
                <button
                  type="button"
                  onClick={onOpenCreateFood}
                  className="app-button-secondary text-sm px-4 py-2"
                >
                  + Create &ldquo;{deferredSearchQuery.trim()}&rdquo;
                </button>
              </div>
            ) : (
              <>
                {activeFoodSources.map((fs, idx) => (
                  <Fragment key={`${fs.sourceType}:${fs.sourceId}`}>
                    {idx > 0 && <InsetRowDivider />}
                    <FoodRow
                      name={fs.name}
                      subtitle={`${Math.round(fs.caloriesPer100g)} kcal / 100g${fs.labelPortionGrams ? ` · serving ${fs.labelPortionGrams}g` : ''}`}
                      leading={
                        fs.kind === 'composite' ? (
                          <svg className="w-4 h-4 text-[var(--app-warning)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 6h14M5 10h14M5 14h10" />
                          </svg>
                        ) : (
                          <FoodSourceBadge sourceType={fs.sourceType} />
                        )
                      }
                      isChecked={isItemPending(fs)}
                      onTap={() => onFoodTap(fs)}
                      macroChips={
                        fs.proteinG != null || fs.carbsG != null || fs.fatG != null
                          ? { p: fs.proteinG, c: fs.carbsG, f: fs.fatG }
                          : undefined
                      }
                    />
                  </Fragment>
                ))}
                {!isSearching && (
                  <>
                    {activeFoodSources.length > 0 && <InsetRowDivider />}
                    <button
                      type="button"
                      onClick={onOpenCreateFood}
                      className="flex w-full items-center gap-3 px-4 py-3 text-sm text-[var(--app-text-muted)] hover:text-[var(--app-brand)] hover:bg-[var(--app-hover-overlay)] transition-colors"
                    >
                      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-xl border border-dashed border-[var(--app-border)] text-lg leading-none">
                        +
                      </span>
                      <span>Create new food</span>
                    </button>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
      {footer}
    </>
  )
}
