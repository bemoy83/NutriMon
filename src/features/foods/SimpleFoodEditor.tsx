import { useEffect, useImperativeHandle, useState } from 'react'
import type { Ref } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/providers/auth'
import type { Product } from '@/types/domain'
import type { SaveHandle } from './RecipeEditor'

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

interface SimpleFoodEditorProps {
  initialProduct: Product | null
  onSaved: () => void
  saveRef: Ref<SaveHandle>
  onCanSaveChange: (canSave: boolean) => void
}

export default function SimpleFoodEditor({
  initialProduct,
  onSaved,
  saveRef,
  onCanSaveChange,
}: SimpleFoodEditorProps) {
  const { user } = useAuth()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { caloriesPer100g: 0 },
  })

  const watchedName = useWatch({ control, name: 'name' })
  const calPer100 = useWatch({ control, name: 'caloriesPer100g' })
  const portionG = useWatch({ control, name: 'labelPortionGrams' })

  useEffect(() => {
    if (!initialProduct) {
      reset({ name: '', caloriesPer100g: 0, proteinPer100g: null, carbsPer100g: null, fatPer100g: null, labelPortionGrams: null })
      return
    }
    const cal100 = initialProduct.caloriesPer100g ?? initialProduct.calories
    reset({
      name: initialProduct.name,
      caloriesPer100g: Math.round(Number(cal100)),
      proteinPer100g: initialProduct.proteinPer100g ?? initialProduct.proteinG ?? null,
      carbsPer100g: initialProduct.carbsPer100g ?? initialProduct.carbsG ?? null,
      fatPer100g: initialProduct.fatPer100g ?? initialProduct.fatG ?? null,
      labelPortionGrams: initialProduct.labelPortionGrams,
    })
  }, [initialProduct, reset])

  const canSave = (watchedName?.trim().length ?? 0) > 0 && !isSubmitting

  useEffect(() => {
    onCanSaveChange(canSave)
  }, [canSave, onCanSaveChange])

  async function doSave(data: FormData): Promise<void> {
    if (!user) return
    setServerError(null)

    const payload = {
      name: data.name,
      calories_per_100g: data.caloriesPer100g,
      protein_per_100g: data.proteinPer100g ?? null,
      carbs_per_100g: data.carbsPer100g ?? null,
      fat_per_100g: data.fatPer100g ?? null,
      calories: Math.round(data.caloriesPer100g),
      protein_g: data.proteinPer100g ?? null,
      carbs_g: data.carbsPer100g ?? null,
      fat_g: data.fatPer100g ?? null,
      default_serving_amount: 100,
      default_serving_unit: 'g',
      label_portion_grams: data.labelPortionGrams ?? null,
      updated_at: new Date().toISOString(),
    }

    const query = initialProduct
      ? supabase.from('products').update(payload).eq('id', initialProduct.id).eq('user_id', user.id)
      : supabase.from('products').insert({ user_id: user.id, ...payload })

    const { error } = await query.select().single()

    if (error) {
      setServerError(error.message)
      throw error
    }

    onSaved()
  }

  useImperativeHandle(saveRef, () => ({
    save: () => new Promise<void>((resolve, reject) => {
      handleSubmit(
        async (data) => { try { await doSave(data); resolve() } catch (e) { reject(e) } },
        () => reject(new Error('Validation failed')),
      )()
    }),
  }))

  const portionKcalPreview =
    portionG && calPer100 != null && calPer100 >= 0
      ? Math.round((portionG * calPer100) / 100)
      : null

  return (
    <div className="flex-1 overflow-y-auto">
      <form className="space-y-4 px-4 py-4">
        <div>
          <label htmlFor="sfe-name" className="block text-sm text-[var(--app-text-secondary)] mb-1">
            Name <span className="text-[var(--app-danger)]">*</span>
          </label>
          <input
            id="sfe-name"
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
          <label htmlFor="sfe-cal" className="block text-sm text-[var(--app-text-secondary)] mb-1">
            Energy (kcal per 100g) <span className="text-[var(--app-danger)]">*</span>
          </label>
          <input
            id="sfe-cal"
            type="number"
            {...register('caloriesPer100g', { valueAsNumber: true })}
            className="app-input px-3 py-2"
            placeholder="e.g. 165"
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
              { id: 'sfe-fat', label: 'Fat (g / 100g)', field: 'fatPer100g' },
              { id: 'sfe-carbs', label: 'Carbs (g / 100g)', field: 'carbsPer100g' },
              { id: 'sfe-protein', label: 'Protein (g / 100g)', field: 'proteinPer100g' },
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
              />
            </div>
          ))}
        </div>

        <div>
          <label htmlFor="sfe-portion" className="block text-xs text-[var(--app-text-secondary)] mb-1">
            Portion on label (g, optional)
          </label>
          <input
            id="sfe-portion"
            type="number"
            step="0.1"
            {...register('labelPortionGrams', { valueAsNumber: true, setValueAs: v => v === '' ? null : Number(v) })}
            className="app-input px-3 py-2 text-sm"
            placeholder="e.g. 30 — if the label lists one serving size"
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
      </form>
    </div>
  )
}
