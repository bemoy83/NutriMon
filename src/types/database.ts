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
      product_recipe_ingredients: {
        Row: ProductRecipeIngredientRow
        Insert: Omit<ProductRecipeIngredientRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<ProductRecipeIngredientRow, 'id' | 'created_at'>>
        Relationships: []
      }
      food_catalog_items: {
        Row: FoodCatalogItemRow
        Insert: Omit<FoodCatalogItemRow, 'created_at' | 'updated_at'>
        Update: Partial<Omit<FoodCatalogItemRow, 'id' | 'source' | 'source_item_id' | 'created_at'>>
        Relationships: []
      }
      catalog_item_usage: {
        Row: CatalogItemUsageRow
        Insert: Omit<CatalogItemUsageRow, 'created_at' | 'updated_at'>
        Update: Partial<Omit<CatalogItemUsageRow, 'user_id' | 'catalog_item_id' | 'created_at'>>
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
      creature_companions: {
        Row: CreatureCompanionRow
        Insert: Omit<CreatureCompanionRow, 'created_at' | 'updated_at'>
        Update: Partial<Omit<CreatureCompanionRow, 'user_id' | 'created_at'>>
        Relationships: []
      }
      creature_battle_snapshots: {
        Row: CreatureBattleSnapshotRow
        Insert: Omit<CreatureBattleSnapshotRow, 'id' | 'created_at'>
        Update: Partial<Omit<CreatureBattleSnapshotRow, 'id' | 'user_id' | 'created_at'>>
        Relationships: []
      }
      daily_feedback: {
        Row: DailyFeedbackRow
        Insert: Omit<DailyFeedbackRow, 'id' | 'created_at'>
        Update: Partial<Omit<DailyFeedbackRow, 'id' | 'user_id' | 'created_at'>>
        Relationships: []
      }
      battle_arenas: {
        Row: BattleArenaRow
        Insert: Omit<BattleArenaRow, 'id' | 'created_at'>
        Update: Partial<Omit<BattleArenaRow, 'id' | 'created_at'>>
        Relationships: []
      }
      battle_opponents: {
        Row: BattleOpponentRow
        Insert: Omit<BattleOpponentRow, 'id' | 'created_at'>
        Update: Partial<Omit<BattleOpponentRow, 'id' | 'created_at'>>
        Relationships: []
      }
      battle_runs: {
        Row: BattleRunRow
        Insert: Omit<BattleRunRow, 'id' | 'created_at'>
        Update: Partial<Omit<BattleRunRow, 'id' | 'user_id' | 'created_at'>>
        Relationships: []
      }
    }
    Functions: {
      ensure_daily_log: {
        Args: { p_log_date: string }
        Returns: DailyLogRow
      }
      create_meal_with_items: {
        Args: { p_log_date: string; p_logged_at: string; p_items: MealItemInput[]; p_meal_type?: string | null; p_meal_name?: string | null; p_template_id?: string | null }
        Returns: MealMutationResult
      }
      update_meal_with_items: {
        Args: { p_meal_id: string; p_logged_at: string; p_items: MealItemUpdateInput[]; p_meal_type?: string | null; p_meal_name?: string | null }
        Returns: MealMutationResult
      }
      delete_meal: {
        Args: { p_meal_id: string }
        Returns: DeleteMealResult
      }
      delete_meal_item: {
        Args: { p_meal_item_id: string }
        Returns: DeleteMealItemResult
      }
      repeat_last_meal: {
        Args: { p_log_date: string }
        Returns: MealMutationResult
      }
      restore_meal_from_snapshot: {
        Args: { p_log_date: string; p_logged_at: string; p_items: RestoreMealSnapshotItemInput[]; p_meal_type?: string | null; p_meal_name?: string | null }
        Returns: MealMutationResult
      }
      save_meal_as_template: {
        Args: { p_meal_id: string; p_name: string }
        Returns: MealTemplateRow
      }
      delete_meal_template: {
        Args: { p_template_id: string }
        Returns: void
      }
      get_meal_templates: {
        Args: Record<string, never>
        Returns: MealTemplateWithItemsRow[]
      }
      get_recent_food_sources: {
        Args: { p_limit?: number }
        Returns: FoodSourceRow[]
      }
      get_frequent_food_sources: {
        Args: { p_limit?: number }
        Returns: FoodSourceRow[]
      }
      search_food_sources: {
        Args: { p_query: string; p_limit?: number }
        Returns: FoodSourceRow[]
      }
      upsert_composite_product: {
        Args: {
          p_product_id: string | null
          p_name: string
          p_total_mass_g: number
          p_piece_count: number | null
          p_piece_label: string | null
          p_ingredients: CompositeIngredientInput[]
        }
        Returns: CompositeProductResult
      }
      get_composite_product: {
        Args: { p_product_id: string }
        Returns: CompositeProductResult | null
      }
      get_battle_hub: {
        Args: { p_battle_date: string }
        Returns: BattleHubRow
      }
      get_arena_list: {
        Args: { p_battle_date: string }
        Returns: ArenaListRow
      }
      get_arena_detail: {
        Args: { p_arena_id: string; p_battle_date: string }
        Returns: BattleHubRow
      }
      start_battle_run: {
        Args: { p_snapshot_id: string; p_opponent_id: string }
        Returns: BattleRunSessionRow
      }
      resolve_battle_run: {
        Args: { p_battle_run_id: string }
        Returns: BattleRunMutationResult
      }
      get_battle_run: {
        Args: { p_battle_run_id: string }
        Returns: BattleRunSessionRow
      }
      submit_battle_action: {
        Args: { p_battle_run_id: string; p_action: string }
        Returns: BattleRunSessionRow
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
  label_portion_grams: number | null
  default_serving_amount: number | null
  default_serving_unit: string | null
  use_count: number
  last_used_at: string | null
  kind: 'simple' | 'composite'
  total_mass_g: number | null
  calories_per_100g: number | null
  protein_per_100g: number | null
  carbs_per_100g: number | null
  fat_per_100g: number | null
  piece_count: number | null
  piece_label: string | null
  created_at: string
  updated_at: string
}

export interface ProductRecipeIngredientRow {
  id: string
  composite_product_id: string
  ingredient_product_id: string | null
  ingredient_catalog_item_id: string | null
  mass_g: number
  sort_order: number
  created_at: string
  updated_at: string
}

export interface FoodCatalogItemRow {
  id: string
  source: string
  source_item_id: string
  name: string
  calories: number
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  default_serving_amount: number
  default_serving_unit: string
  edible_portion_percent: number | null
  created_at: string
  updated_at: string
}

export interface CatalogItemUsageRow {
  user_id: string
  catalog_item_id: string
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
  meal_type: string | null
  meal_name: string | null
  total_calories: number
  item_count: number
  created_at: string
  updated_at: string
}

export interface MealTemplateRow {
  id: string
  user_id: string
  name: string
  default_meal_type: string | null
  use_count: number
  last_used_at: string | null
  created_at: string
  updated_at: string
}

export interface MealTemplateItemRow {
  id: string
  template_id: string
  product_id: string | null
  catalog_item_id: string | null
  quantity: number
  name_snapshot: string
  calories_snapshot: number
  serving_amount_snapshot: number | null
  serving_unit_snapshot: string | null
  created_at: string
}

export interface MealItemRow {
  id: string
  meal_id: string
  product_id: string | null
  catalog_item_id: string | null
  quantity: number
  product_name_snapshot: string
  calories_per_serving_snapshot: number
  protein_g_snapshot: number | null
  carbs_g_snapshot: number | null
  fat_g_snapshot: number | null
  serving_amount_snapshot: number | null
  serving_unit_snapshot: string | null
  label_portion_grams_snapshot: number | null
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

export interface CreatureCompanionRow {
  user_id: string
  name: string
  stage: 'baby' | 'adult' | 'champion'
  level: number
  xp: number
  current_condition: 'thriving' | 'steady' | 'recovering'
  hatched_at: string
  evolved_to_adult_at: string | null
  evolved_to_champion_at: string | null
  created_at: string
  updated_at: string
}

export interface CreatureBattleSnapshotRow {
  id: string
  user_id: string
  prep_date: string
  battle_date: string
  strength: number
  resilience: number
  momentum: number
  vitality: number
  readiness_score: number
  readiness_band: 'recovering' | 'building' | 'ready' | 'peak'
  condition: 'thriving' | 'steady' | 'recovering'
  level: number
  stage: 'baby' | 'adult' | 'champion'
  source_daily_evaluation_id: string
  xp_gained: number
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

export interface BattleArenaRow {
  id: string
  arena_key: string
  name: string
  description: string | null
  sort_order: number
  is_active: boolean
  unlock_requires_boss_opponent_id: string | null
  /** Denormalised name, present only in arena-list RPC response rows. */
  unlock_boss_name?: string | null
  map_x: number | null
  map_y: number | null
  created_at: string
}

/**
 * Optional 4th per-opponent ability definition for Phase 3 boss encounters.
 * Stored as JSONB in battle_opponents.special_action.
 */
export interface SpecialActionDefinition {
  /** Combat effect category. */
  type: 'damage_boost' | 'status_apply' | 'multi_hit'
  /** Display name shown in battle UI (e.g. "Magma Surge"). */
  label: string
  /** Tooltip / flavour description. */
  description: string
  /** Action selection weight 0–100, added on top of action_weights. */
  weight: number
  /** Type-specific effect parameters. */
  params: Record<string, unknown>
}

export interface BattleOpponentRow {
  id: string
  arena_id: string
  name: string
  archetype: string
  recommended_level: number
  strength: number
  resilience: number
  momentum: number
  vitality: number
  sort_order: number
  unlock_level: number
  is_active: boolean
  is_arena_boss: boolean
  is_defeated?: boolean
  is_challengeable?: boolean
  rewarded_win_turn_count?: number | null
  rewarded_win_remaining_hp_pct?: number | null
  rewarded_win_xp_awarded?: number | null
  required_previous_opponent_id?: string | null
  required_previous_opponent_name?: string | null
  lock_reason?: string | null
  action_weights: Record<string, number>
  /** Optional 4th per-opponent ability for Phase 3 boss encounters. Null for all current opponents. */
  special_action: SpecialActionDefinition | null
  size_class: string
  created_at: string
}

export interface BattleLogEntryRow {
  id: string
  round: number
  phase: 'initiative' | 'action' | 'result'
  actor: 'player' | 'opponent' | 'system'
  action: string
  damage: number
  target: 'opponent' | 'player' | null
  target_hp_after: number | null
  crit: boolean
  defended: boolean
  consumed_momentum_boost: boolean
  consumed_next_attack_bonus: boolean
  message: string
}

export interface BattleRunRow {
  id: string
  user_id: string
  battle_date: string
  snapshot_id: string
  opponent_id: string
  outcome: 'pending' | 'win' | 'loss'
  turn_count: number | null
  remaining_hp_pct: number | null
  xp_awarded: number
  arena_progress_awarded: number
  reward_claimed: boolean
  created_at: string
  status: 'active' | 'completed'
  player_max_hp: number
  player_current_hp: number
  opponent_max_hp: number
  opponent_current_hp: number
  current_round: number
  battle_log: BattleLogEntryRow[]
  completed_at: string | null
  player_last_action: string | null
  enemy_last_action: string | null
  player_momentum_boost: number
  enemy_momentum_boost: number
  player_next_attack_bonus: number
  enemy_next_attack_bonus: number
}

export interface BattleRunSessionRow extends BattleRunRow {
  snapshot: CreatureBattleSnapshotRow
  opponent: BattleOpponentRow
  companion: CreatureCompanionRow
}

export interface MealItemInput {
  product_id?: string
  catalog_item_id?: string
  quantity: number
  composite_quantity_mode?: 'grams' | 'pieces'
}

export interface MealItemUpdateInput {
  product_id?: string
  catalog_item_id?: string
  meal_item_id?: string
  quantity: number
  composite_quantity_mode?: 'grams' | 'pieces'
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

export interface MealTemplateWithItemsRow extends MealTemplateRow {
  items: MealTemplateItemRow[]
}

export interface CreaturePreviewRow {
  tomorrow_readiness_score: number
  tomorrow_readiness_band: 'recovering' | 'building' | 'ready' | 'peak'
  projected_strength: number
  projected_resilience: number
  projected_momentum: number
  projected_vitality: number
  meal_rating: 'strong' | 'solid' | 'weak'
  meal_feedback_message: string
}

export interface MealMutationResult {
  meal: {
    id: string
    daily_log_id: string
    logged_at: string
    meal_type: string | null
    meal_name: string | null
    total_calories: number
    item_count: number
  }
  meal_items: {
    id: string
    product_id: string | null
    catalog_item_id: string | null
    quantity: number
    product_name_snapshot: string
    calories_per_serving_snapshot: number
    line_total_calories: number
  }[]
  /** meal_items row IDs inserted in this RPC call only (merge updates omitted). Optional; not used for toast undo on add. */
  inserted_meal_item_ids?: string[]
  daily_log: DailyLogRow
  creature_preview?: CreaturePreviewRow | null
}

export interface FoodSourceRow {
  source_type: 'user_product' | 'catalog_item'
  source_id: string
  name: string
  calories: number
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  calories_per_100g: number
  default_serving_amount: number | null
  default_serving_unit: string | null
  label_portion_grams: number | null
  use_count: number
  last_used_at: string | null
  kind: string
  piece_count: number | null
  piece_label: string | null
  total_mass_g: number | null
}

export interface DeleteMealResult {
  deleted_meal_id: string
  daily_log: DailyLogRow
  creature_preview?: CreaturePreviewRow | null
}

export interface DeleteMealItemResult {
  daily_log: DailyLogRow
  meal: MealMutationResult['meal'] | null
  creature_preview?: CreaturePreviewRow | null
}

export interface BattleRecommendationRow {
  opponent_id: string
  name: string
  archetype: string
  recommended_level: number
  likely_outcome: 'favored' | 'competitive' | 'risky'
}

export interface BattleHubRow {
  companion: CreatureCompanionRow | null
  snapshot: CreatureBattleSnapshotRow | null
  recommended_opponent: BattleRecommendationRow | null
  arena_opponents: BattleOpponentRow[]
  battle_history: BattleRunWithOpponentRow[]
  active_battle_run: BattleRunSessionRow | null
}

export interface BattleRunWithOpponentRow extends BattleRunRow {
  opponent?: BattleOpponentRow | null
}

export interface BattleRunMutationResult {
  battle_run: BattleRunRow
  opponent?: BattleOpponentRow | null
}

export interface ArenaListArenaRow extends BattleArenaRow {
  opponent_count: number
  defeated_count: number
  is_unlocked: boolean
  has_active_run: boolean
}

export interface ArenaListRow {
  companion: CreatureCompanionRow | null
  snapshot: CreatureBattleSnapshotRow | null
  arenas: ArenaListArenaRow[]
}

export interface CompositeIngredientInput {
  product_id: string | null
  catalog_item_id: string | null
  mass_g: number
  sort_order: number
}

export interface CompositeIngredientResult {
  id: string
  ingredient_product_id: string | null
  ingredient_catalog_item_id: string | null
  mass_g: number
  sort_order: number
  name: string
  calories: number
  calories_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
}

export interface CompositeProductResult {
  product: ProductRow
  ingredients: CompositeIngredientResult[]
}
