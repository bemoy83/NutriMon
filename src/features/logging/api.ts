import { supabase } from '@/lib/supabase'
import type {
  DeleteMealResult,
  MealItemInput,
  MealItemUpdateInput,
  MealMutationResult,
  MealTemplateRow,
  MealTemplateWithItemsRow,
  RestoreMealSnapshotItemInput,
} from '@/types/database'
import { mapMealTemplate } from '@/lib/domainMappers'
import type { MealTemplate } from '@/types/domain'

export async function createMealWithItems(
  logDate: string,
  loggedAt: string,
  items: MealItemInput[],
  mealType?: string | null,
  mealName?: string | null,
  templateId?: string | null,
): Promise<MealMutationResult> {
  const { data, error } = await supabase.rpc('create_meal_with_items', {
    p_log_date: logDate,
    p_logged_at: loggedAt,
    p_items: items,
    p_meal_type: mealType ?? null,
    p_meal_name: mealName ?? null,
    p_template_id: templateId ?? null,
  })

  if (error) throw error
  return data
}

export async function updateMealWithItems(
  mealId: string,
  loggedAt: string,
  items: MealItemUpdateInput[],
  mealType?: string | null,
  mealName?: string | null,
): Promise<MealMutationResult> {
  const { data, error } = await supabase.rpc('update_meal_with_items', {
    p_meal_id: mealId,
    p_logged_at: loggedAt,
    p_items: items,
    p_meal_type: mealType ?? null,
    p_meal_name: mealName ?? null,
  })

  if (error) throw error
  return data
}

export async function saveMealAsTemplate(mealId: string, name: string): Promise<MealTemplateRow> {
  const { data, error } = await supabase.rpc('save_meal_as_template', {
    p_meal_id: mealId,
    p_name: name,
  })
  if (error) throw error
  return data
}

export async function deleteMealTemplate(templateId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_meal_template', { p_template_id: templateId })
  if (error) throw error
}

export async function getMealTemplates(): Promise<MealTemplate[]> {
  const { data, error } = await supabase.rpc('get_meal_templates')
  if (error) throw error
  return ((data as MealTemplateWithItemsRow[]) ?? []).map(mapMealTemplate)
}

export async function deleteMeal(mealId: string): Promise<DeleteMealResult> {
  const { data, error } = await supabase.rpc('delete_meal', { p_meal_id: mealId })
  if (error) throw error
  return data
}

export async function repeatLastMeal(logDate: string): Promise<MealMutationResult> {
  const { data, error } = await supabase.rpc('repeat_last_meal', { p_log_date: logDate })
  if (error) throw error
  return data
}

export async function repeatLastMealOfType(
  userId: string,
  logDate: string,
  loggedAt: string,
  mealType: string,
): Promise<MealMutationResult> {
  const { data, error } = await supabase
    .from('meals')
    .select(`
      meal_name,
      meal_type,
      meal_items (
        quantity,
        product_name_snapshot,
        calories_per_serving_snapshot,
        protein_g_snapshot,
        carbs_g_snapshot,
        fat_g_snapshot,
        serving_amount_snapshot,
        serving_unit_snapshot
      ),
      daily_logs!inner ( log_date )
    `)
    .eq('user_id', userId)
    .lt('daily_logs.log_date', logDate)
    .eq('meal_type', mealType)
    .order('logged_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error(`No previous ${mealType} found`)

  const row = data as {
    meal_name: string | null
    meal_type: string | null
    meal_items: {
      quantity: number
      product_name_snapshot: string
      calories_per_serving_snapshot: number
      protein_g_snapshot: number | null
      carbs_g_snapshot: number | null
      fat_g_snapshot: number | null
      serving_amount_snapshot: number | null
      serving_unit_snapshot: string | null
    }[]
    daily_logs: { log_date: string }[]
  }

  const items: RestoreMealSnapshotItemInput[] = row.meal_items.map((i) => ({
    quantity: i.quantity,
    product_name_snapshot: i.product_name_snapshot,
    calories_per_serving_snapshot: i.calories_per_serving_snapshot,
    protein_g_snapshot: i.protein_g_snapshot,
    carbs_g_snapshot: i.carbs_g_snapshot,
    fat_g_snapshot: i.fat_g_snapshot,
    serving_amount_snapshot: i.serving_amount_snapshot,
    serving_unit_snapshot: i.serving_unit_snapshot,
  }))

  return restoreMealFromSnapshot(logDate, loggedAt, items, mealType, row.meal_name)
}

export async function restoreMealFromSnapshot(
  logDate: string,
  loggedAt: string,
  items: RestoreMealSnapshotItemInput[],
  mealType?: string | null,
  mealName?: string | null,
): Promise<MealMutationResult> {
  const { data, error } = await supabase.rpc('restore_meal_from_snapshot', {
    p_log_date: logDate,
    p_logged_at: loggedAt,
    p_items: items,
    p_meal_type: mealType ?? null,
    p_meal_name: mealName ?? null,
  })

  if (error) throw error
  return data
}
