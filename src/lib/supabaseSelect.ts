/**
 * Explicit PostgREST `select` lists — avoids `select('*')` and documents mapper expectations.
 */

export const HABIT_METRICS_LATEST_SELECT = [
  'id',
  'user_id',
  'log_date',
  'current_streak',
  'longest_streak',
  'days_logged_last_7',
  'last_log_date',
  'created_at',
].join(', ')

export const CREATURE_STATS_LATEST_SELECT = [
  'id',
  'user_id',
  'log_date',
  'strength',
  'resilience',
  'momentum',
  'vitality',
  'stage',
  'created_at',
].join(', ')

export const CREATURE_COMPANION_SELECT = [
  'user_id',
  'name',
  'stage',
  'level',
  'xp',
  'current_condition',
  'hatched_at',
  'evolved_to_adult_at',
  'evolved_to_champion_at',
  'created_at',
  'updated_at',
].join(', ')

/** Profile form + read-only “Your stats” on ProfilePage */
export const PROFILE_FULL_SELECT = [
  'user_id',
  'height_cm',
  'starting_weight_kg',
  'age_years',
  'activity_level',
  'timezone',
  'calorie_target',
  'onboarding_completed_at',
  'created_at',
  'updated_at',
].join(', ')

export const WEIGHT_ENTRIES_LIST_SELECT = [
  'id',
  'user_id',
  'entry_date',
  'weight_kg',
  'source_unit',
  'source_value',
  'notes',
  'created_at',
  'updated_at',
].join(', ')
