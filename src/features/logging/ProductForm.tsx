import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/providers/auth'
import { useEffect, useState } from 'react'
import type { Product } from '@/types/domain'
import { mapProduct } from '@/lib/domainMappers'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  calories: z
    .number({ error: 'Enter calories' })
    .int()
    .min(0)
    .max(5000),
  proteinG: z.number().min(0).optional().nullable(),
  carbsG: z.number().min(0).optional().nullable(),
  fatG: z.number().min(0).optional().nullable(),
  defaultServingAmount: z.number().positive().optional().nullable(),
  defaultServingUnit: z.string().optional().nullable(),
})

type FormData = z.infer<typeof schema>

interface Props {
  initialProduct?: Product | null
  onSave: (product: Product) => void
  onSaveAndAdd?: (product: Product) => void
  onCancel: () => void
}

export default function ProductForm({ initialProduct = null, onSave, onSaveAndAdd, onCancel }: Props) {
  const { user } = useAuth()
  const [serverError, setServerError] = useState<string | null>(null)
  const isEditMode = !!initialProduct

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { calories: 0 },
  })

  useEffect(() => {
    if (!initialProduct) {
      reset({
        name: '',
        calories: 0,
        proteinG: null,
        carbsG: null,
        fatG: null,
        defaultServingAmount: null,
        defaultServingUnit: null,
      })
      return
    }

    reset({
      name: initialProduct.name,
      calories: initialProduct.calories,
      proteinG: initialProduct.proteinG,
      carbsG: initialProduct.carbsG,
      fatG: initialProduct.fatG,
      defaultServingAmount: initialProduct.defaultServingAmount,
      defaultServingUnit: initialProduct.defaultServingUnit,
    })
  }, [initialProduct, reset])

  async function save(data: FormData): Promise<Product | null> {
    if (!user) return null
    setServerError(null)

    const payload = {
      name: data.name,
      calories: data.calories,
      protein_g: data.proteinG ?? null,
      carbs_g: data.carbsG ?? null,
      fat_g: data.fatG ?? null,
      default_serving_amount: data.defaultServingAmount ?? null,
      default_serving_unit: data.defaultServingUnit ?? null,
      updated_at: new Date().toISOString(),
    }

    const query = initialProduct
      ? supabase
          .from('products')
          .update(payload)
          .eq('id', initialProduct.id)
          .eq('user_id', user.id)
      : supabase
          .from('products')
          .insert({
            user_id: user.id,
            ...payload,
          })

    const { data: product, error } = await query
      .select()
      .single()

    if (error) {
      setServerError(error.message)
      return null
    }

    return mapProduct(product)
  }

  return (
    <form className="space-y-4 p-4">
      <div>
        <label htmlFor="name" className="block text-sm text-slate-300 mb-1">
          Name <span className="text-red-400">*</span>
        </label>
        <input
          id="name"
          type="text"
          autoFocus
          {...register('name')}
          className="app-input px-3 py-2"
          placeholder="e.g. Chicken breast"
        />
        {errors.name && (
          <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="calories" className="block text-sm text-slate-300 mb-1">
          Calories (per serving) <span className="text-red-400">*</span>
        </label>
        <input
          id="calories"
          type="number"
          {...register('calories', { valueAsNumber: true })}
          className="app-input px-3 py-2"
          placeholder="350"
        />
        {errors.calories && (
          <p className="text-red-400 text-xs mt-1">{errors.calories.message}</p>
        )}
      </div>

      {/* Macros row */}
      <div className="grid grid-cols-3 gap-3">
        {(
          [
            { id: 'proteinG', label: 'Protein (g)', field: 'proteinG' },
            { id: 'carbsG', label: 'Carbs (g)', field: 'carbsG' },
            { id: 'fatG', label: 'Fat (g)', field: 'fatG' },
          ] as const
        ).map(({ id, label, field }) => (
          <div key={id}>
            <label htmlFor={id} className="block text-xs text-slate-400 mb-1">
              {label}
            </label>
            <input
              id={id}
              type="number"
              step="0.1"
              {...register(field, { valueAsNumber: true, setValueAs: v => v === '' ? null : Number(v) })}
              className="app-input px-3 py-2 text-sm"
              placeholder="—"
            />
          </div>
        ))}
      </div>

      {/* Serving info */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="servingAmount" className="block text-xs text-slate-400 mb-1">
            Serving amount
          </label>
          <input
            id="servingAmount"
            type="number"
            step="0.1"
            {...register('defaultServingAmount', { valueAsNumber: true, setValueAs: v => v === '' ? null : Number(v) })}
            className="app-input px-3 py-2 text-sm"
            placeholder="100"
          />
        </div>
        <div>
          <label htmlFor="servingUnit" className="block text-xs text-slate-400 mb-1">
            Unit
          </label>
          <input
            id="servingUnit"
            type="text"
            {...register('defaultServingUnit')}
            className="app-input px-3 py-2 text-sm"
            placeholder="g / ml / oz"
          />
        </div>
      </div>

      {serverError && (
        <p className="text-red-400 text-sm">{serverError}</p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="app-button-secondary flex-1 py-2.5"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={isSubmitting}
          onClick={handleSubmit(async (data) => {
            const product = await save(data)
            if (product) onSave(product)
          })}
          className="app-button-secondary flex-1 py-2.5"
        >
          {isEditMode ? 'Save changes' : 'Save'}
        </button>
        {onSaveAndAdd && !isEditMode && (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmit(async (data) => {
              const product = await save(data)
              if (product) onSaveAndAdd(product)
            })}
            className="app-button-primary flex-1 py-2.5"
          >
            Save & Add
          </button>
        )}
      </div>
    </form>
  )
}
