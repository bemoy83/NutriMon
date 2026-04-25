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

  return (
    <div className="flex flex-col h-full bg-[var(--app-bg)]">
      {/* Sticky page header */}
      <div className="flex-none flex items-center gap-2 px-4 py-3 bg-white border-b border-[var(--app-border-muted)]">
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
        <h1 className="flex-1 text-base font-semibold text-[var(--app-text-primary)] truncate">{title}</h1>
      </div>

      {/* Type selector — only in create mode */}
      {isNew && (
        <div className="flex-none bg-white border-b border-[var(--app-border-muted)]">
          <SegmentedTabs
            options={TYPE_OPTIONS}
            value={editorType}
            onChange={setEditorType}
          />
        </div>
      )}

      {/* Editor — fills remaining height */}
      <div className="flex-1 min-h-0 flex flex-col">
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

      {/* Sticky footer */}
      <div className="flex-none px-4 pt-4 pb-20 bg-white border-t border-[var(--app-border-muted)] space-y-2">
        {deleteError && (
          <p className="text-[var(--app-danger)] text-xs text-center">{deleteError}</p>
        )}
        <button
          type="button"
          disabled={!canSave || saving}
          onClick={handleSave}
          className="app-button-primary w-full py-3"
        >
          {saving ? 'Saving\u2026' : isNew ? 'Save' : 'Save changes'}
        </button>
        {!isNew && product && (
          <button
            type="button"
            disabled={deleting}
            onClick={handleDelete}
            className="app-button-danger w-full py-2.5 text-sm"
          >
            {deleting ? 'Deleting\u2026' : 'Delete food'}
          </button>
        )}
      </div>
    </div>
  )
}
