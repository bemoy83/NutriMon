import { useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/app/providers/auth'
import { getUserProducts, deleteProduct } from '@/features/foods/api'
import { useInvalidateProductQueries } from '@/features/logging/queryInvalidation'
import LoadingState from '@/components/ui/LoadingState'
import SegmentedTabs from '@/components/ui/SegmentedTabs'
import RecipeEditor from '@/features/foods/RecipeEditor'
import SimpleFoodEditor from '@/features/foods/SimpleFoodEditor'
import type { SaveHandle } from '@/features/foods/RecipeEditor'

const TYPE_OPTIONS = [
  { value: 'simple' as const, label: 'Simple food' },
  { value: 'recipe' as const, label: 'Recipe' },
] as const

export default function FoodDetailPage() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isNew = !id

  const [editorType, setEditorType] = useState<'simple' | 'recipe'>('simple')
  const [canSave, setCanSave] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const saveRef = useRef<SaveHandle>(null)

  const invalidateProducts = useInvalidateProductQueries()

  const productsQuery = useQuery({
    queryKey: ['my-food-products', user?.id],
    enabled: !!user,
    queryFn: () => getUserProducts(user!.id),
  })

  const product = isNew ? null : (productsQuery.data ?? []).find((p) => p.id === id) ?? null

  function onSaved() {
    invalidateProducts()
    navigate('/app/my-food')
  }

  async function handleSave() {
    if (!saveRef.current || !canSave || saving) return
    setSaving(true)
    try {
      await saveRef.current.save()
    } catch {
      // editor shows its own error message
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!product) return
    if (!window.confirm(`Delete "${product.name}"? Logged meals will keep their historical snapshots.`)) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteProduct(product.id)
      invalidateProducts()
      navigate('/app/my-food')
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  if (!isNew && productsQuery.isLoading) return <LoadingState fullScreen />
  if (!isNew && !productsQuery.isLoading && !product) return <Navigate to="/app/my-food" replace />

  const kind = isNew
    ? editorType
    : product?.kind === 'composite' ? 'recipe' : 'simple'

  const title = isNew
    ? (editorType === 'recipe' ? 'New recipe' : 'New food')
    : (product?.name ?? 'Edit food')

  const kindLabel = kind === 'recipe' ? 'Recipe' : 'Simple food'

  return (
    <div className="flex min-h-full flex-col bg-[var(--app-bg)]">
      {/* Sheet panel — fill main height so footer stays at bottom; editors scroll inside */}
      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-2xl border border-[var(--app-border)] bg-white shadow-[var(--app-shadow-sheet)]"
        role="region"
        aria-label={title}
      >
        {/* Drag handle cue — matches BottomSheet */}
        <div className="flex flex-none flex-col rounded-t-2xl bg-white">
          <div className="flex justify-center pt-2" aria-hidden>
            <div className="h-1 w-10 rounded-full bg-slate-300" />
          </div>

          {/* Header — same title row padding + title typography as BottomSheet */}
          <header className="flex flex-none flex-col">
            <div className="flex items-center gap-2 px-4 py-3">
              <button
                type="button"
                onClick={() => navigate('/app/my-food')}
                className="flex h-9 w-9 flex-none items-center justify-center rounded-xl text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-hover-overlay)]"
                aria-label="Back to My food"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h3 className="min-w-0 flex-1 truncate text-base font-semibold text-[var(--app-text-primary)]">
                {title}
              </h3>
              <button
                type="button"
                onClick={() => navigate('/app/my-food')}
                className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-elevated)] hover:text-[var(--app-text-primary)]"
                aria-label="Close"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {!isNew && (
              <div className="mt-2 flex pr-4 pl-11">
                <span className="inline-flex items-center rounded-full bg-[var(--app-surface-muted)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--app-text-muted)]">
                  {kindLabel}
                </span>
              </div>
            )}
          </header>
        </div>

        {/* Type selector — create mode, full-width strip (no nested card) */}
        {isNew && (
          <div className="flex-none w-full border-b border-[var(--app-border-muted)] bg-white">
            <SegmentedTabs
              options={TYPE_OPTIONS}
              value={editorType}
              onChange={setEditorType}
              className="w-full !bg-white !px-4 !py-2 !shadow-none"
            />
          </div>
        )}

        {/* Editor */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {kind === 'simple' ? (
            <SimpleFoodEditor
              key={isNew ? 'new-simple' : id}
              initialProduct={product}
              onSaved={onSaved}
              saveRef={saveRef}
              onCanSaveChange={setCanSave}
            />
          ) : (
            <RecipeEditor
              key={isNew ? 'new-recipe' : id}
              editProductId={isNew ? null : (id ?? null)}
              onSaved={onSaved}
              saveRef={saveRef}
              onCanSaveChange={setCanSave}
            />
          )}
        </div>

        {/* Action bar — MealSheet footer pattern; pb clears fixed bottom nav */}
        <footer className="flex-none space-y-3 border-t border-[var(--app-border-muted)] bg-white px-4 py-5 pb-[max(5rem,calc(4.5rem+env(safe-area-inset-bottom,0px)))]">
          {deleteError && (
            <p className="text-center text-xs text-[var(--app-danger)]">{deleteError}</p>
          )}
          <button
            type="button"
            disabled={!canSave || saving}
            onClick={handleSave}
            className="app-button-primary w-full py-3 !rounded-xl shadow-[0_10px_24px_rgb(124_58_237/0.22)] disabled:shadow-none"
          >
            {saving ? 'Saving\u2026' : isNew ? 'Save' : 'Save changes'}
          </button>
          {!isNew && product && (
            <button
              type="button"
              disabled={deleting}
              onClick={handleDelete}
              className="w-full py-2 text-center text-sm font-medium text-[var(--app-danger)] transition-colors hover:text-[var(--app-danger)]/90 disabled:opacity-50"
            >
              {deleting ? 'Deleting\u2026' : 'Delete food'}
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}
