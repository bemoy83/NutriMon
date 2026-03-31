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
