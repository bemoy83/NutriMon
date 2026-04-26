import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { mapProduct } from '@/lib/domainMappers'
import type { Product } from '@/types/domain'
import type { ProductRow } from '@/types/database'

export const simpleFoodSchema = z.object({
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

export type SimpleFoodFormData = z.infer<typeof simpleFoodSchema>

export interface SimpleFoodFormPrefill {
  name?: string
  caloriesPer100g?: number
  proteinPer100g?: number | null
  carbsPer100g?: number | null
  fatPer100g?: number | null
  labelPortionGrams?: number | null
}

export function buildSimpleFoodPayload(data: SimpleFoodFormData) {
  return {
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
  }
}

export async function saveSimpleFoodProduct({
  data,
  initialProduct,
  userId,
}: {
  data: SimpleFoodFormData
  initialProduct?: Product | null
  userId: string
}): Promise<Product> {
  const payload = {
    name: data.name,
    ...buildSimpleFoodPayload(data),
    updated_at: new Date().toISOString(),
  }

  const query = initialProduct
    ? supabase
        .from('products')
        .update(payload)
        .eq('id', initialProduct.id)
        .eq('user_id', userId)
    : supabase
        .from('products')
        .insert({
          user_id: userId,
          kind: 'simple',
          ...payload,
        })

  const { data: row, error } = await query.select().single()
  if (error) throw error
  return mapProduct(row as ProductRow)
}

export function useSimpleFoodForm({
  initialProduct,
  initialValues,
}: {
  initialProduct?: Product | null
  initialValues?: SimpleFoodFormPrefill
}) {
  const form = useForm<SimpleFoodFormData>({
    resolver: zodResolver(simpleFoodSchema),
    defaultValues: { caloriesPer100g: 0 },
  })

  const { control, reset } = form
  const watchedName = useWatch({ control, name: 'name' })
  const calPer100 = useWatch({ control, name: 'caloriesPer100g' })
  const portionG = useWatch({ control, name: 'labelPortionGrams' })

  const ivName = initialValues?.name
  const ivCal = initialValues?.caloriesPer100g
  const ivProtein = initialValues?.proteinPer100g
  const ivCarbs = initialValues?.carbsPer100g
  const ivFat = initialValues?.fatPer100g
  const ivPortion = initialValues?.labelPortionGrams

  useEffect(() => {
    if (!initialProduct) {
      reset({
        name: ivName ?? '',
        caloriesPer100g: ivCal ?? 0,
        proteinPer100g: ivProtein ?? null,
        carbsPer100g: ivCarbs ?? null,
        fatPer100g: ivFat ?? null,
        labelPortionGrams: ivPortion ?? null,
      })
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
  }, [initialProduct, reset, ivName, ivCal, ivProtein, ivCarbs, ivFat, ivPortion])

  const portionKcalPreview =
    portionG && calPer100 != null && calPer100 >= 0
      ? Math.round((portionG * calPer100) / 100)
      : null

  return {
    form,
    watchedName,
    portionKcalPreview,
  }
}
