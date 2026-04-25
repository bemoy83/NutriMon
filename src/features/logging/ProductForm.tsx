import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/providers/auth'
import { useEffect, useState } from 'react'
import type { Product } from '@/types/domain'
import { mapProduct } from '@/lib/domainMappers'
import { selectAllOnFocus } from '@/lib/selectAllOnFocus'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  caloriesPer100g: z
    .number({ error: 'Enter kcal per 100g' })
    .int()
    .min(0)
    .max(9000),
  proteinPer100g: z.number().min(0).optional().nullable(),
  carbsPer100g: z.number().min(0).optional().nullable(),
  fatPer100g: z.number().min(0).optional().nullable(),
  labelPortionGrams: z.number().positive().optional().nullable(),
})

type FormData = z.infer<typeof schema>

interface Props {
  initialProduct?: Product | null
  onSave: (product: Product) => void
  onSaveAndAdd?: (product: Product) => void
  onCancel: () => void
}

function denormalizedPayload(data: FormData) {
  const calRound = Math.round(data.caloriesPer100g)
  const calNum = data.caloriesPer100g
  return {
    calories_per_100g: calNum,
    protein_per_100g: data.proteinPer100g ?? null,
    carbs_per_100g: data.carbsPer100g ?? null,
    fat_per_100g: data.fatPer100g ?? null,
    calories: calRound,
    protein_g: data.proteinPer100g ?? null,
    carbs_g: data.carbsPer100g ?? null,
    fat_g: data.fatPer100g ?? null,
    default_serving_amount: 100,
    default_serving_unit: 'g',
    label_portion_grams: data.labelPortionGrams ?? null,
  }
}

export default function ProductForm({ initialProduct = null, onSave, onSaveAndAdd, onCancel }: Props) {
  const { user } = useAuth()
  const [serverError, setServerError] = useState<string | null>(null)
  const isEditMode = !!initialProduct

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { caloriesPer100g: 0 },
  })

  const calPer100 = useWatch({ control, name: 'caloriesPer100g' })
  const portionG = useWatch({ control, name: 'labelPortionGrams' })

  useEffect(() => {
    if (!initialProduct) {
      reset({
        name: '',
        caloriesPer100g: 0,
        proteinPer100g: null,
        carbsPer100g: null,
        fatPer100g: null,
        labelPortionGrams: null,
      })
      return
    }

    const cal100 =
      initialProduct.caloriesPer100g ?? initialProduct.calories

    reset({
      name: initialProduct.name,
      caloriesPer100g: Math.round(Number(cal100)),
      proteinPer100g: initialProduct.proteinPer100g ?? initialProduct.proteinG ?? null,
      carbsPer100g: initialProduct.carbsPer100g ?? initialProduct.carbsG ?? null,
      fatPer100g: initialProduct.fatPer100g ?? initialProduct.fatG ?? null,
      labelPortionGrams: initialProduct.labelPortionGrams,
    })
  }, [initialProduct, reset])

  async function save(data: FormData): Promise<Product | null> {
    if (!user) return null
    setServerError(null)

    const base = denormalizedPayload(data)

    const payload = {
      name: data.name,
      ...base,
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

  const portionKcalPreview =
    portionG && calPer100 != null && calPer100 >= 0
      ? Math.round((portionG * calPer100) / 100)
      : null

  return (
    <form className="space-y-4 p-4">
      <div>
        <label htmlFor="name" className="block text-sm text-[var(--app-text-secondary)] mb-1">
          Name <span className="text-[var(--app-danger)]">*</span>
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
          <p className="text-[var(--app-danger)] text-xs mt-1">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="caloriesPer100g" className="block text-sm text-[var(--app-text-secondary)] mb-1">
          Energy (kcal per 100g) <span className="text-[var(--app-danger)]">*</span>
        </label>
        <input
          id="caloriesPer100g"
          type="number"
          {...register('caloriesPer100g', { valueAsNumber: true })}
          className="app-input px-3 py-2"
          placeholder="e.g. 165"
          onFocus={selectAllOnFocus}
        />
        {errors.caloriesPer100g && (
          <p className="text-[var(--app-danger)] text-xs mt-1">{errors.caloriesPer100g.message}</p>
        )}
        <p className="text-xs text-[var(--app-text-muted)] mt-1">
          Use the values from the "per 100g" column on the nutrition label.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {(
          [
            { id: 'fatPer100g', label: 'Fat (g / 100g)', field: 'fatPer100g' },
            { id: 'carbsPer100g', label: 'Carbs (g / 100g)', field: 'carbsPer100g' },
            { id: 'proteinPer100g', label: 'Protein (g / 100g)', field: 'proteinPer100g' },
          ] as const
        ).map(({ id, label, field }) => (
          <div key={id}>
            <label htmlFor={id} className="block text-xs text-[var(--app-text-secondary)] mb-1">
              {label}
            </label>
            <input
              id={id}
              type="number"
              step="0.1"
              {...register(field, { valueAsNumber: true, setValueAs: v => v === '' ? null : Number(v) })}
              className="app-input px-3 py-2 text-sm"
              placeholder="—"
              onFocus={selectAllOnFocus}
            />
          </div>
        ))}
      </div>

      <div>
        <label htmlFor="labelPortionGrams" className="block text-xs text-[var(--app-text-secondary)] mb-1">
          Portion on label (g, optional)
        </label>
        <input
          id="labelPortionGrams"
          type="number"
          step="0.1"
          {...register('labelPortionGrams', { valueAsNumber: true, setValueAs: v => v === '' ? null : Number(v) })}
          className="app-input px-3 py-2 text-sm"
          placeholder="e.g. 30 — if the label lists one serving size"
          onFocus={selectAllOnFocus}
        />
        {portionKcalPreview != null && (
          <p className="text-xs text-[var(--app-text-muted)] mt-1">
            ≈ {portionKcalPreview} kcal per that portion (derived from per 100g values).
          </p>
        )}
      </div>

      {serverError && (
        <p className="text-[var(--app-danger)] text-sm">{serverError}</p>
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
          className="app-button-primary flex-1 py-2.5"
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
