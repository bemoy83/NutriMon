import { useEffect, useState } from 'react'
import { useInvalidateProducts } from './useProducts'
import { useInvalidateDailyLog } from './useDailyLog'
import { createMealWithItems } from './api'
import type { FoodSource, Product } from '@/types/domain'
import ProductForm from './ProductForm'
import type { MealMutationResult } from '@/types/database'
import { useFoodSourceSearch, useFrequentFoodSources, useRecentFoodSources } from './useFoodSources'

interface PendingItem {
  foodSource: FoodSource
  quantity: number
}

interface Props {
  logDate: string
  loggedAt: string
  onClose: () => void
  onAdded: (result: MealMutationResult) => void
}

export default function QuickAddSheet({ logDate, loggedAt, onClose, onAdded }: Props) {
  const [tab, setTab] = useState<'recent' | 'frequent' | 'search' | 'create'>('recent')
  const [searchQuery, setSearchQuery] = useState('')
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([])
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const invalidateDailyLog = useInvalidateDailyLog()
  const invalidateProducts = useInvalidateProducts()

  const recentQuery = useRecentFoodSources()
  const frequentQuery = useFrequentFoodSources()
  const searchQuery_ = useFoodSourceSearch(searchQuery)

  function getFoodSourceKey(foodSource: FoodSource): string {
    return `${foodSource.sourceType}:${foodSource.sourceId}`
  }

  function productToFoodSource(product: Product): FoodSource {
    return {
      sourceType: 'user_product',
      sourceId: product.id,
      name: product.name,
      calories: product.calories,
      proteinG: product.proteinG,
      carbsG: product.carbsG,
      fatG: product.fatG,
      defaultServingAmount: product.defaultServingAmount,
      defaultServingUnit: product.defaultServingUnit,
      useCount: product.useCount,
      lastUsedAt: product.lastUsedAt,
    }
  }

  function addPendingItem(foodSource: FoodSource) {
    setPendingItems((prev) => {
      const existing = prev.find((i) => getFoodSourceKey(i.foodSource) === getFoodSourceKey(foodSource))
      if (existing) return prev
      return [...prev, { foodSource, quantity: 1 }]
    })
  }

  function updateQuantity(foodSourceKey: string, quantity: number) {
    if (quantity <= 0) {
      setPendingItems((prev) => prev.filter((i) => getFoodSourceKey(i.foodSource) !== foodSourceKey))
    } else {
      setPendingItems((prev) =>
        prev.map((i) => (getFoodSourceKey(i.foodSource) === foodSourceKey ? { ...i, quantity } : i)),
      )
    }
  }

  async function handleConfirm() {
    if (pendingItems.length === 0) return
    setAdding(true)
    setAddError(null)

    try {
      const result = await createMealWithItems(
        logDate,
        loggedAt,
        pendingItems.map((item) => ({
          ...(item.foodSource.sourceType === 'user_product'
            ? { product_id: item.foodSource.sourceId }
            : { catalog_item_id: item.foodSource.sourceId }),
          quantity: item.quantity,
        })),
      )
      invalidateDailyLog(logDate)
      invalidateProducts()
      onAdded(result)
      onClose()
    } catch (error) {
      setAddError(error instanceof Error ? error.message : 'Unable to add meal')
    } finally {
      setAdding(false)
    }
  }

  function getActiveProducts(): FoodSource[] {
    if (tab === 'recent') return recentQuery.data ?? []
    if (tab === 'frequent') return frequentQuery.data ?? []
    if (tab === 'search') return searchQuery_.data ?? []
    return []
  }

  if (tab === 'create') {
    return (
      <SheetContainer onClose={onClose} title="New product">
        <ProductForm
          onSave={() => {
            invalidateProducts()
            setTab('recent')
          }}
          onSaveAndAdd={(product) => {
            addPendingItem(productToFoodSource(product))
            invalidateProducts()
            setTab('recent')
          }}
          onCancel={() => setTab('recent')}
        />
      </SheetContainer>
    )
  }

  return (
    <SheetContainer onClose={onClose} title="Add meal">
      {/* Pending items summary */}
      {pendingItems.length > 0 && (
        <div className="px-4 py-2 bg-indigo-950 border-b border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-indigo-300 text-sm font-medium">
              {pendingItems.length} item{pendingItems.length !== 1 ? 's' : ''} selected
            </span>
            <span className="text-white text-sm font-semibold">
              {pendingItems.reduce((sum, i) => sum + Math.round(i.quantity * i.foodSource.calories), 0)} kcal
            </span>
          </div>
          <div className="space-y-1">
            {pendingItems.map((item) => (
              <div key={getFoodSourceKey(item.foodSource)} className="flex items-center justify-between">
                <span className="text-slate-300 text-xs truncate flex-1">
                  {item.foodSource.name}
                </span>
                <div className="flex items-center gap-2 ml-2">
                  <button
                    onClick={() => updateQuantity(getFoodSourceKey(item.foodSource), item.quantity - 0.5)}
                    className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-white bg-slate-700 rounded"
                  >
                    −
                  </button>
                  <span className="text-white text-xs w-8 text-center">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(getFoodSourceKey(item.foodSource), item.quantity + 0.5)}
                    className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-white bg-slate-700 rounded"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-700">
        {(['recent', 'frequent', 'search'] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t)
              if (t !== 'search') setSearchQuery('')
            }}
            className={`flex-1 py-2.5 text-xs font-medium capitalize transition-colors ${
              tab === t
                ? 'text-indigo-400 border-b-2 border-indigo-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Search input */}
      {tab === 'search' && (
        <div className="px-4 py-2">
          <input
            type="text"
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search foods…"
            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      )}

      {/* Product list */}
      <div className="flex-1 overflow-y-auto">
        {getActiveProducts().map((foodSource: FoodSource) => {
          const pending = pendingItems.find((i) => getFoodSourceKey(i.foodSource) === getFoodSourceKey(foodSource))
          return (
            <ProductRow
              key={getFoodSourceKey(foodSource)}
              foodSource={foodSource}
              quantity={pending?.quantity ?? null}
              onAdd={() => addPendingItem(foodSource)}
              onUpdateQuantity={(q) => updateQuantity(getFoodSourceKey(foodSource), q)}
            />
          )
        })}

        {/* Create new shortcut */}
        <button
          onClick={() => setTab('create')}
          className="w-full flex items-center gap-3 px-4 py-3 text-indigo-400 hover:bg-slate-800 transition-colors border-t border-slate-800"
        >
          <span className="w-8 h-8 flex items-center justify-center bg-indigo-950 rounded-full text-indigo-400">
            +
          </span>
          <span className="text-sm">Create new product</span>
        </button>
      </div>

      {/* Confirm */}
      {addError && <p className="text-red-400 text-xs px-4 pb-2">{addError}</p>}
      <div className="p-4 border-t border-slate-700">
        <button
          onClick={handleConfirm}
          disabled={pendingItems.length === 0 || adding}
          className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors disabled:opacity-40"
        >
          {adding ? 'Adding…' : pendingItems.length === 0 ? 'Select items to add' : `Add ${pendingItems.length} item${pendingItems.length !== 1 ? 's' : ''}`}
        </button>
      </div>
    </SheetContainer>
  )
}

function ProductRow({
  foodSource,
  quantity,
  onAdd,
  onUpdateQuantity,
}: {
  foodSource: FoodSource
  quantity: number | null
  onAdd: () => void
  onUpdateQuantity: (q: number) => void
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-white text-sm truncate">{foodSource.name}</p>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            foodSource.sourceType === 'user_product'
              ? 'bg-slate-700 text-slate-200'
              : 'bg-emerald-950 text-emerald-300'
          }`}>
            {foodSource.sourceType === 'user_product' ? 'My product' : 'Built-in'}
          </span>
        </div>
        <p className="text-slate-400 text-xs">
          {foodSource.calories} kcal
          {foodSource.defaultServingAmount && foodSource.defaultServingUnit
            ? ` / ${foodSource.defaultServingAmount}${foodSource.defaultServingUnit}`
            : ' / serving'}
        </p>
      </div>

      {quantity !== null ? (
        <div className="flex items-center gap-2">
          <button
            onClick={() => onUpdateQuantity(quantity - 0.5)}
            className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white bg-slate-700 rounded-full"
          >
            −
          </button>
          <span className="text-white text-sm w-8 text-center">{quantity}</span>
          <button
            onClick={() => onUpdateQuantity(quantity + 0.5)}
            className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white bg-slate-700 rounded-full"
          >
            +
          </button>
        </div>
      ) : (
        <button
          onClick={onAdd}
          className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white bg-slate-700 rounded-full"
        >
          +
        </button>
      )}
    </div>
  )
}

function SheetContainer({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode
  onClose: () => void
  title: string
}) {
  // Close on backdrop click
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col bg-slate-900 rounded-t-2xl max-h-[85vh] sm:max-w-lg sm:mx-auto sm:rounded-xl sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h3 className="text-white font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex flex-col flex-1 overflow-hidden">{children}</div>
      </div>
    </>
  )
}
