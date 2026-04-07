import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/providers/auth'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { CALORIE_TARGET_MIN, CALORIE_TARGET_MAX } from '@/lib/constants'
import type { Product } from '@/types/domain'
import ProductForm from '@/features/logging/ProductForm'
import { useInvalidateProductQueries } from '@/features/logging/queryInvalidation'
import { mapProduct } from '@/lib/domainMappers'
import LoadingState from '@/components/ui/LoadingState'
import EmptyState from '@/components/ui/EmptyState'
import BottomSheet from '@/components/ui/BottomSheet'

const schema = z.object({
  calorieTarget: z
    .number({ error: 'Enter a calorie target' })
    .int()
    .min(CALORIE_TARGET_MIN)
    .max(CALORIE_TARGET_MAX),
  timezone: z.string().min(1, 'Timezone required'),
})

type FormData = z.infer<typeof schema>

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: 'Sedentary',
  lightly_active: 'Lightly active',
  moderately_active: 'Moderately active',
  very_active: 'Very active',
}

export default function ProfilePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const invalidateProducts = useInvalidateProductQueries()
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [productSearch, setProductSearch] = useState('')
  const [showCreateProduct, setShowCreateProduct] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [productError, setProductError] = useState<string | null>(null)
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null)

  const profileQuery = useQuery({
    queryKey: ['profile-full', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user!.id)
        .single()
      return data
    },
  })

  const profile = profileQuery.data
  const productsQuery = useQuery({
    queryKey: ['profile-products', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', user!.id)
        .order('updated_at', { ascending: false })

      if (error) throw error

      return (data ?? []).map(mapProduct)
    },
  })

  const filteredProducts = (productsQuery.data ?? []).filter((product) =>
    product.name.toLowerCase().includes(productSearch.trim().toLowerCase()),
  )

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (profile) {
      reset({
        calorieTarget: profile.calorie_target ?? 2000,
        timezone: profile.timezone ?? '',
      })
    }
  }, [profile, reset])

  async function onSubmit(data: FormData) {
    if (!user) return
    setServerError(null)
    setSaveSuccess(false)

    const { error } = await supabase
      .from('profiles')
      .update({
        calorie_target: data.calorieTarget,
        timezone: data.timezone,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    if (error) {
      setServerError(error.message)
      return
    }

    qc.invalidateQueries({ queryKey: ['profile', user.id] })
    qc.invalidateQueries({ queryKey: ['profile-full', user.id] })
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 3000)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  async function handleDeleteProduct(product: Product) {
    if (!window.confirm(`Delete "${product.name}"? Logged meals will keep their historical snapshots.`)) {
      return
    }

    setDeletingProductId(product.id)
    setProductError(null)

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', product.id)
      .eq('user_id', user!.id)

    setDeletingProductId(null)
    if (error) {
      setProductError(error.message)
      return
    }

    invalidateProducts()
    if (editingProduct?.id === product.id) {
      setEditingProduct(null)
    }
  }

  if (profileQuery.isLoading) {
    return <LoadingState fullScreen />
  }

  return (
    <div className="app-page min-h-full px-4 py-6 pb-24">
      <h1 className="text-xl font-bold text-[var(--app-text-primary)] mb-6">Profile</h1>

      {/* Read-only profile info */}
      <div className="app-card mb-4 space-y-3 p-4">
        <h2 className="text-[var(--app-text-primary)] text-base font-semibold">Your stats</h2>
        <ProfileRow label="Email" value={user?.email ?? '—'} />
        <ProfileRow label="Height" value={profile?.height_cm ? `${profile.height_cm} cm` : '—'} />
        <ProfileRow label="Starting weight" value={profile?.starting_weight_kg ? `${profile.starting_weight_kg} kg` : '—'} />
        <ProfileRow label="Age" value={profile?.age_years ? `${profile.age_years}` : '—'} />
        <ProfileRow
          label="Activity level"
          value={profile?.activity_level ? ACTIVITY_LABELS[profile.activity_level] ?? profile.activity_level : '—'}
        />
      </div>

      {/* Editable settings */}
      <form onSubmit={handleSubmit(onSubmit)} className="app-card mb-4 space-y-4 p-4">
        <h2 className="text-[var(--app-text-primary)] text-base font-semibold">Settings</h2>

        <div>
          <label htmlFor="calorieTarget" className="mb-1 block text-sm text-[var(--app-text-secondary)]">
            Daily calorie target
          </label>
          <input
            id="calorieTarget"
            type="number"
            {...register('calorieTarget', { valueAsNumber: true })}
            className="app-input px-3 py-2"
          />
          {errors.calorieTarget && (
            <p className="text-[var(--app-danger)] text-xs mt-1">{errors.calorieTarget.message}</p>
          )}
          <p className="text-[var(--app-text-muted)] text-xs mt-1">
            Range: {CALORIE_TARGET_MIN}–{CALORIE_TARGET_MAX}
          </p>
        </div>

        <div>
          <label htmlFor="timezone" className="mb-1 block text-sm text-[var(--app-text-secondary)]">
            Timezone
          </label>
          <input
            id="timezone"
            type="text"
            {...register('timezone')}
            className="app-input px-3 py-2"
            placeholder="America/New_York"
          />
          {errors.timezone && (
            <p className="text-[var(--app-danger)] text-xs mt-1">{errors.timezone.message}</p>
          )}
        </div>

        {serverError && <p className="text-[var(--app-danger)] text-sm">{serverError}</p>}
        {saveSuccess && <p className="text-[var(--app-success)] text-sm">Saved.</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="app-button-primary w-full py-2.5"
        >
          {isSubmitting ? 'Saving…' : 'Save changes'}
        </button>
      </form>

      {/* Product management */}
      <div className="app-card mb-4 space-y-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[var(--app-text-primary)] text-base font-semibold">Products</h2>
            <p className="text-[var(--app-text-muted)] text-xs mt-1">Manage reusable foods for quick logging.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingProduct(null)
              setShowCreateProduct(true)
            }}
            className="app-button-primary px-3 py-2 text-sm"
          >
            New product
          </button>
        </div>

        <input
          type="text"
          value={productSearch}
          onChange={(event) => setProductSearch(event.target.value)}
          placeholder="Search products"
          className="app-input px-3 py-2 text-sm"
        />

        {productError && <p className="text-[var(--app-danger)] text-xs">{productError}</p>}

        <div className="space-y-2">
          {productsQuery.isLoading ? (
            <p className="text-[var(--app-text-muted)] text-sm">Loading products…</p>
          ) : filteredProducts.length === 0 ? (
            <EmptyState title="No matching products." className="py-4" />
          ) : (
            filteredProducts.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="text-[var(--app-text-primary)] text-sm truncate">{product.name}</p>
                  <p className="text-[var(--app-text-muted)] text-xs">
                    {product.calories} kcal
                    {product.defaultServingAmount && product.defaultServingUnit
                      ? ` / ${product.defaultServingAmount}${product.defaultServingUnit}`
                      : ' / serving'}
                    {product.useCount > 0 ? ` · used ${product.useCount}x` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateProduct(false)
                      setEditingProduct(product)
                    }}
                    className="app-button-secondary px-3 py-1.5 text-xs"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={deletingProductId === product.id}
                    onClick={() => handleDeleteProduct(product)}
                    className="app-button-danger px-3 py-1.5 text-xs"
                  >
                    {deletingProductId === product.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        className="app-button-danger w-full rounded-xl py-2.5"
      >
        Sign out
      </button>

      {(showCreateProduct || editingProduct) && (
        <BottomSheet
          onClose={() => {
            setShowCreateProduct(false)
            setEditingProduct(null)
          }}
          title={editingProduct ? 'Edit product' : 'New product'}
        >
          <ProductForm
            initialProduct={editingProduct}
            onSave={() => {
              invalidateProducts()
              setShowCreateProduct(false)
              setEditingProduct(null)
            }}
            onCancel={() => {
              setShowCreateProduct(false)
              setEditingProduct(null)
            }}
          />
        </BottomSheet>
      )}
    </div>
  )
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--app-text-muted)] text-sm">{label}</span>
      <span className="text-[var(--app-text-primary)] text-sm">{value}</span>
    </div>
  )
}
