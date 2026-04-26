import { useEffect, useImperativeHandle, useState } from 'react'
import type { ReactNode, Ref } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/providers/auth'
import type { Product } from '@/types/domain'
import type { SaveHandle } from './RecipeEditor'
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

const MACRO_FIELDS = [
  { id: 'sfe-fat', label: 'Fat', field: 'fatPer100g' as const, accent: 'var(--app-macro-fat)' },
  { id: 'sfe-carbs', label: 'Carbs', field: 'carbsPer100g' as const, accent: 'var(--app-macro-carbs)' },
  { id: 'sfe-protein', label: 'Protein', field: 'proteinPer100g' as const, accent: 'var(--app-macro-protein)' },
] as const

interface SimpleFoodEditorProps {
  initialProduct: Product | null
  onSaved: () => void
  saveRef: Ref<SaveHandle>
  onCanSaveChange: (canSave: boolean) => void
  dangerZone?: ReactNode
}

export default function SimpleFoodEditor({
  initialProduct,
  onSaved,
  saveRef,
  onCanSaveChange,
  dangerZone,
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

        <section aria-labelledby="sfe-nutrition-heading" className="space-y-5">
          <h2
            id="sfe-nutrition-heading"
            className="text-[10px] font-semibold uppercase tracking-widest text-[var(--app-text-subtle)]"
          >
            Nutrition
          </h2>

          <div className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[var(--app-text-muted)]">
              Energy
            </h3>
            <div>
              <label htmlFor="sfe-cal" className="mb-1 block text-sm text-[var(--app-text-secondary)]">
                Kcal per 100g <span className="text-[var(--app-danger)]">*</span>
              </label>
              <input
                id="sfe-cal"
                type="number"
                {...register('caloriesPer100g', { valueAsNumber: true })}
                className="app-input px-3 py-2"
                placeholder="e.g. 165"
                onFocus={selectAllOnFocus}
              />
              {errors.caloriesPer100g && (
                <p className="mt-1 text-xs text-[var(--app-danger)]">{errors.caloriesPer100g.message}</p>
              )}
              <p className="mt-1 text-xs text-[var(--app-text-muted)]">
                Use the values from the &quot;per 100g&quot; column on the nutrition label.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[var(--app-text-muted)]">
              Macros
            </h3>
            <p className="text-xs text-[var(--app-text-muted)] -mt-1 mb-1">
              Grams per 100g (optional)
            </p>
            <div className="grid grid-cols-3 gap-3">
              {MACRO_FIELDS.map(({ id, label, field, accent }) => (
                <div key={id}>
                  <label
                    htmlFor={id}
                    className="mb-1 block text-sm font-semibold leading-snug"
                    style={{ color: accent }}
                  >
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
          </div>
        </section>

        <div>
          <label htmlFor="sfe-portion" className="mb-1 block text-sm text-[var(--app-text-secondary)]">
            Serving size (g, optional)
          </label>
          <input
            id="sfe-portion"
            type="number"
            step="0.1"
            {...register('labelPortionGrams', { valueAsNumber: true, setValueAs: v => v === '' ? null : Number(v) })}
            className="app-input px-3 py-2 text-sm"
            placeholder="e.g. 30 — define any portion you use"
            onFocus={selectAllOnFocus}
          />
          {portionKcalPreview != null && (
            <p className="mt-1 text-xs text-[var(--app-text-muted)]">
              ≈ {portionKcalPreview} kcal per serving (derived from per 100g values).
            </p>
          )}
        </div>

        {serverError && (
          <p className="text-[var(--app-danger)] text-sm">{serverError}</p>
        )}
        {dangerZone}
      </form>
    </div>
  )
}
