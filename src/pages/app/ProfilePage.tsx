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
import { useInvalidateProducts } from '@/features/logging/useProducts'

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
  const invalidateProducts = useInvalidateProducts()
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

      return (data ?? []).map((row) => ({
        id: row.id,
        userId: row.user_id,
        name: row.name,
        calories: row.calories,
        proteinG: row.protein_g,
        carbsG: row.carbs_g,
        fatG: row.fat_g,
        defaultServingAmount: row.default_serving_amount,
        defaultServingUnit: row.default_serving_unit,
        useCount: row.use_count,
        lastUsedAt: row.last_used_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }))
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
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-slate-400 text-sm">Loading…</div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-slate-950 px-4 py-6 pb-24">
      <h1 className="text-xl font-bold text-white mb-6">Profile</h1>

      {/* Read-only profile info */}
      <div className="bg-slate-800 rounded-xl p-4 mb-4 space-y-3">
        <h2 className="text-white font-medium text-sm">Your stats</h2>
        <ProfileRow
          label="Email"
          value={user?.email ?? '—'}
        />
        <ProfileRow
          label="Height"
          value={profile?.height_cm ? `${profile.height_cm} cm` : '—'}
        />
        <ProfileRow
          label="Starting weight"
          value={profile?.starting_weight_kg ? `${profile.starting_weight_kg} kg` : '—'}
        />
        <ProfileRow
          label="Age"
          value={profile?.age_years ? `${profile.age_years}` : '—'}
        />
        <ProfileRow
          label="Activity level"
          value={
            profile?.activity_level ? ACTIVITY_LABELS[profile.activity_level] ?? profile.activity_level : '—'
          }
        />
      </div>

      {/* Editable settings */}
      <form onSubmit={handleSubmit(onSubmit)} className="bg-slate-800 rounded-xl p-4 mb-4 space-y-4">
        <h2 className="text-white font-medium text-sm">Settings</h2>

        <div>
          <label htmlFor="calorieTarget" className="block text-sm text-slate-300 mb-1">
            Daily calorie target
          </label>
          <input
            id="calorieTarget"
            type="number"
            {...register('calorieTarget', { valueAsNumber: true })}
            className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {errors.calorieTarget && (
            <p className="text-red-400 text-xs mt-1">{errors.calorieTarget.message}</p>
          )}
          <p className="text-slate-500 text-xs mt-1">
            Range: {CALORIE_TARGET_MIN}–{CALORIE_TARGET_MAX}
          </p>
        </div>

        <div>
          <label htmlFor="timezone" className="block text-sm text-slate-300 mb-1">
            Timezone
          </label>
          <input
            id="timezone"
            type="text"
            {...register('timezone')}
            className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="America/New_York"
          />
          {errors.timezone && (
            <p className="text-red-400 text-xs mt-1">{errors.timezone.message}</p>
          )}
        </div>

        {serverError && <p className="text-red-400 text-sm">{serverError}</p>}
        {saveSuccess && <p className="text-green-400 text-sm">Saved.</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors disabled:opacity-50"
        >
          {isSubmitting ? 'Saving…' : 'Save changes'}
        </button>
      </form>

      {/* Product management */}
      <div className="bg-slate-800 rounded-xl p-4 mb-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-white font-medium text-sm">Products</h2>
            <p className="text-slate-400 text-xs mt-1">Manage reusable foods for quick logging.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingProduct(null)
              setShowCreateProduct(true)
            }}
            className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm transition-colors"
          >
            New product
          </button>
        </div>

        <input
          type="text"
          value={productSearch}
          onChange={(event) => setProductSearch(event.target.value)}
          placeholder="Search products"
          className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        {productError && <p className="text-red-400 text-xs">{productError}</p>}

        <div className="space-y-2">
          {productsQuery.isLoading ? (
            <p className="text-slate-400 text-sm">Loading products…</p>
          ) : filteredProducts.length === 0 ? (
            <p className="text-slate-500 text-sm">No matching products.</p>
          ) : (
            filteredProducts.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="text-white text-sm truncate">{product.name}</p>
                  <p className="text-slate-400 text-xs">
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
                    className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-200 text-xs hover:bg-slate-600 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={deletingProductId === product.id}
                    onClick={() => handleDeleteProduct(product)}
                    className="px-3 py-1.5 rounded-lg border border-red-900 text-red-400 text-xs hover:bg-red-950 transition-colors disabled:opacity-50"
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
        className="w-full py-2.5 rounded-xl border border-red-900 text-red-400 hover:bg-red-950 transition-colors"
      >
        Sign out
      </button>

      {(showCreateProduct || editingProduct) && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60"
            onClick={() => {
              setShowCreateProduct(false)
              setEditingProduct(null)
            }}
            aria-hidden="true"
          />
          <div className="fixed inset-x-4 top-1/2 z-50 mx-auto w-full max-w-lg -translate-y-1/2 rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
              <h3 className="text-white font-semibold">
                {editingProduct ? 'Edit product' : 'New product'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowCreateProduct(false)
                  setEditingProduct(null)
                }}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
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
          </div>
        </>
      )}
    </div>
  )
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400 text-sm">{label}</span>
      <span className="text-white text-sm">{value}</span>
    </div>
  )
}
