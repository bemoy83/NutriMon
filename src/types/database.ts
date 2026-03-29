export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow
        Insert: Omit<ProfileRow, 'created_at' | 'updated_at'>
        Update: Partial<Omit<ProfileRow, 'user_id'>>
        Relationships: []
      }
      products: {
        Row: ProductRow
        Insert: Omit<ProductRow, 'id' | 'created_at' | 'updated_at' | 'use_count' | 'last_used_at'>
        Update: Partial<Omit<ProductRow, 'id' | 'user_id' | 'created_at'>>
        Relationships: []
      }
      daily_logs: {
        Row: DailyLogRow
        Insert: Omit<DailyLogRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<DailyLogRow, 'id' | 'user_id' | 'created_at'>>
        Relationships: []
      }
      meals: {
        Row: MealRow
        Insert: Omit<MealRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<MealRow, 'id' | 'user_id' | 'created_at'>>
        Relationships: []
      }
      meal_items: {
        Row: MealItemRow
        Insert: Omit<MealItemRow, 'id' | 'created_at'>
        Update: Partial<Omit<MealItemRow, 'id' | 'created_at'>>
        Relationships: []
      }
      weight_entries: {
        Row: WeightEntryRow
        Insert: Omit<WeightEntryRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<WeightEntryRow, 'id' | 'user_id' | 'created_at'>>
        Relationships: []
      }
      daily_evaluations: {
        Row: DailyEvaluationRow
        Insert: Omit<DailyEvaluationRow, 'id' | 'created_at'>
        Update: Partial<Omit<DailyEvaluationRow, 'id' | 'user_id' | 'created_at'>>
        Relationships: []
      }
      habit_metrics: {
        Row: HabitMetricsRow
        Insert: Omit<HabitMetricsRow, 'id' | 'created_at'>
        Update: Partial<Omit<HabitMetricsRow, 'id' | 'user_id' | 'created_at'>>
        Relationships: []
      }
      behavior_attributes: {
        Row: BehaviorAttributesRow
        Insert: Omit<BehaviorAttributesRow, 'id' | 'created_at'>
        Update: Partial<Omit<BehaviorAttributesRow, 'id' | 'user_id' | 'created_at'>>
        Relationships: []
      }
      creature_stats: {
        Row: CreatureStatsRow
        Insert: Omit<CreatureStatsRow, 'id' | 'created_at'>
        Update: Partial<Omit<CreatureStatsRow, 'id' | 'user_id' | 'created_at'>>
        Relationships: []
      }
      daily_feedback: {
        Row: DailyFeedbackRow
        Insert: Omit<DailyFeedbackRow, 'id' | 'created_at'>
        Update: Partial<Omit<DailyFeedbackRow, 'id' | 'user_id' | 'created_at'>>
        Relationships: []
      }
    }
    Functions: {
      ensure_daily_log: {
        Args: { p_log_date: string }
        Returns: DailyLogRow
      }
      create_meal_with_items: {
        Args: { p_log_date: string; p_logged_at: string; p_items: MealItemInput[] }
        Returns: MealMutationResult
      }
      update_meal_with_items: {
        Args: { p_meal_id: string; p_logged_at: string; p_items: MealItemUpdateInput[] }
        Returns: MealMutationResult
      }
      delete_meal: {
        Args: { p_meal_id: string }
        Returns: DeleteMealResult
      }
      repeat_last_meal: {
        Args: { p_log_date: string }
        Returns: MealMutationResult
      }
      restore_meal_from_snapshot: {
        Args: { p_log_date: string; p_logged_at: string; p_items: RestoreMealSnapshotItemInput[] }
        Returns: MealMutationResult
      }
    }
    Views: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export interface ProfileRow {
  user_id: string
  height_cm: number | null
  starting_weight_kg: number | null
  age_years: number | null
  sex_for_tdee: 'male' | 'female' | null
  activity_level: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | null
  timezone: string | null
  calorie_target: number | null
  goal_weight_kg: number | null
  onboarding_completed_at: string | null
  created_at: string
  updated_at: string
}

export interface ProductRow {
  id: string
  user_id: string
  name: string
  calories: number
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  default_serving_amount: number | null
  default_serving_unit: string | null
  use_count: number
  last_used_at: string | null
  created_at: string
  updated_at: string
}

export interface DailyLogRow {
  id: string
  user_id: string
  log_date: string
  total_calories: number
  meal_count: number
  is_finalized: boolean
  finalized_at: string | null
  created_at: string
  updated_at: string
}

export interface MealRow {
  id: string
  user_id: string
  daily_log_id: string
  logged_at: string
  total_calories: number
  item_count: number
  created_at: string
  updated_at: string
}

export interface MealItemRow {
  id: string
  meal_id: string
  product_id: string | null
  quantity: number
  product_name_snapshot: string
  calories_per_serving_snapshot: number
  protein_g_snapshot: number | null
  carbs_g_snapshot: number | null
  fat_g_snapshot: number | null
  serving_amount_snapshot: number | null
  serving_unit_snapshot: string | null
  line_total_calories: number
  created_at: string
}

export interface WeightEntryRow {
  id: string
  user_id: string
  entry_date: string
  weight_kg: number
  source_unit: 'kg' | 'lb'
  source_value: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface DailyEvaluationRow {
  id: string
  user_id: string
  daily_log_id: string
  log_date: string
  target_calories: number
  consumed_calories: number
  calorie_delta: number
  adherence_score: number
  adjusted_adherence: number
  status: 'optimal' | 'acceptable' | 'poor' | 'no_data'
  calculation_version: string
  finalized_at: string
  created_at: string
}

export interface HabitMetricsRow {
  id: string
  user_id: string
  log_date: string
  current_streak: number
  longest_streak: number
  days_logged_last_7: number
  last_log_date: string | null
  created_at: string
}

export interface BehaviorAttributesRow {
  id: string
  user_id: string
  log_date: string
  consistency_score: number
  stability_score: number
  momentum_score: number
  discipline_score: number
  calculation_version: string
  calculated_at: string
  created_at: string
}

export interface CreatureStatsRow {
  id: string
  user_id: string
  log_date: string
  strength: number
  resilience: number
  momentum: number
  vitality: number
  stage: 'baby' | 'adult' | 'champion'
  created_at: string
}

export interface DailyFeedbackRow {
  id: string
  user_id: string
  log_date: string
  daily_evaluation_id: string
  status: 'optimal' | 'acceptable' | 'poor' | 'no_data'
  message: string
  recommendation: string
  created_at: string
}

export interface MealItemInput {
  product_id: string
  quantity: number
}

export interface MealItemUpdateInput {
  product_id?: string
  meal_item_id?: string
  quantity: number
  product_name_snapshot?: string
  calories_per_serving_snapshot?: number
  protein_g_snapshot?: number | null
  carbs_g_snapshot?: number | null
  fat_g_snapshot?: number | null
  serving_amount_snapshot?: number | null
  serving_unit_snapshot?: string | null
}

export interface RestoreMealSnapshotItemInput {
  quantity: number
  product_name_snapshot: string
  calories_per_serving_snapshot: number
  protein_g_snapshot?: number | null
  carbs_g_snapshot?: number | null
  fat_g_snapshot?: number | null
  serving_amount_snapshot?: number | null
  serving_unit_snapshot?: string | null
}

export interface MealMutationResult {
  meal: {
    id: string
    daily_log_id: string
    logged_at: string
    total_calories: number
    item_count: number
  }
  meal_items: {
    id: string
    product_id: string | null
    quantity: number
    product_name_snapshot: string
    calories_per_serving_snapshot: number
    line_total_calories: number
  }[]
  daily_log: DailyLogRow
}

export interface DeleteMealResult {
  deleted_meal_id: string
  daily_log: DailyLogRow
}
