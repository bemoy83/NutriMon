import { supabase } from '@/lib/supabase'
import type {
  DeleteMealResult,
  MealItemInput,
  MealItemUpdateInput,
  MealMutationResult,
  RestoreMealSnapshotItemInput,
} from '@/types/database'

export async function createMealWithItems(
  logDate: string,
  loggedAt: string,
  items: MealItemInput[],
  mealType?: string | null,
): Promise<MealMutationResult> {
  const { data, error } = await supabase.rpc('create_meal_with_items', {
    p_log_date: logDate,
    p_logged_at: loggedAt,
    p_items: items,
    p_meal_type: mealType ?? null,
  })

  if (error) throw error
  return data
}

export async function updateMealWithItems(
  mealId: string,
  loggedAt: string,
  items: MealItemUpdateInput[],
  mealType?: string | null,
): Promise<MealMutationResult> {
  const { data, error } = await supabase.rpc('update_meal_with_items', {
    p_meal_id: mealId,
    p_logged_at: loggedAt,
    p_items: items,
    p_meal_type: mealType ?? null,
  })

  if (error) throw error
  return data
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
): Promise<MealMutationResult> {
  const { data, error } = await supabase.rpc('restore_meal_from_snapshot', {
    p_log_date: logDate,
    p_logged_at: loggedAt,
    p_items: items,
    p_meal_type: mealType ?? null,
  })

  if (error) throw error
  return data
}
