import { describe, expect, it } from 'vitest'
import {
  mapBattleHub,
  mapCreaturePreview,
  mapDailyLog,
  mapFoodSource,
  mapHabitMetrics,
  mapMeal,
  mapProduct,
} from '../domainMappers'

describe('domainMappers', () => {
  it('maps product and food-source rows into domain shapes', () => {
    expect(
      mapProduct({
        id: 'product-1',
        user_id: 'user-1',
        name: 'Greek yogurt',
        calories: 120,
        protein_g: 15,
        carbs_g: 6,
        fat_g: 3,
        default_serving_amount: 170,
        default_serving_unit: 'g',
        use_count: 4,
        last_used_at: '2026-01-01T00:00:00.000Z',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      }),
    ).toEqual({
      id: 'product-1',
      userId: 'user-1',
      name: 'Greek yogurt',
      calories: 120,
      proteinG: 15,
      carbsG: 6,
      fatG: 3,
      defaultServingAmount: 170,
      defaultServingUnit: 'g',
      useCount: 4,
      lastUsedAt: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })

    expect(
      mapFoodSource({
        source_type: 'catalog_item',
        source_id: 'catalog-1',
        name: 'Apple',
        calories: 95,
        protein_g: 0.5,
        carbs_g: 25,
        fat_g: 0.3,
        default_serving_amount: 1,
        default_serving_unit: 'pc',
        use_count: 12,
        last_used_at: '2026-01-02T00:00:00.000Z',
      }),
    ).toEqual({
      sourceType: 'catalog_item',
      sourceId: 'catalog-1',
      name: 'Apple',
      calories: 95,
      proteinG: 0.5,
      carbsG: 25,
      fatG: 0.3,
      defaultServingAmount: 1,
      defaultServingUnit: 'pc',
      useCount: 12,
      lastUsedAt: '2026-01-02T00:00:00.000Z',
    })
  })

  it('maps daily-log related rows into domain shapes', () => {
    expect(
      mapDailyLog({
        id: 'log-1',
        user_id: 'user-1',
        log_date: '2026-01-03',
        total_calories: 1800,
        meal_count: 3,
        is_finalized: true,
        finalized_at: '2026-01-03T22:00:00.000Z',
        created_at: '2026-01-03T00:00:00.000Z',
        updated_at: '2026-01-03T22:00:00.000Z',
      }),
    ).toEqual({
      id: 'log-1',
      userId: 'user-1',
      logDate: '2026-01-03',
      totalCalories: 1800,
      mealCount: 3,
      isFinalized: true,
      finalizedAt: '2026-01-03T22:00:00.000Z',
      createdAt: '2026-01-03T00:00:00.000Z',
      updatedAt: '2026-01-03T22:00:00.000Z',
    })

    expect(
      mapMeal(
        {
          id: 'meal-1',
          user_id: 'user-1',
          daily_log_id: 'log-1',
          logged_at: '2026-01-03T08:00:00.000Z',
          meal_type: null,
          meal_name: null,
          total_calories: 600,
          item_count: 2,
          created_at: '2026-01-03T08:00:00.000Z',
          updated_at: '2026-01-03T08:00:00.000Z',
        },
        [],
      ),
    ).toEqual({
      id: 'meal-1',
      userId: 'user-1',
      dailyLogId: 'log-1',
      loggedAt: '2026-01-03T08:00:00.000Z',
      mealType: null,
      mealName: null,
      totalCalories: 600,
      itemCount: 2,
      createdAt: '2026-01-03T08:00:00.000Z',
      updatedAt: '2026-01-03T08:00:00.000Z',
      items: [],
    })

    expect(
      mapHabitMetrics({
        id: 'habit-1',
        user_id: 'user-1',
        log_date: '2026-01-03',
        current_streak: 4,
        longest_streak: 9,
        days_logged_last_7: 6,
        last_log_date: '2026-01-03',
        created_at: '2026-01-03T22:00:00.000Z',
      }),
    ).toEqual({
      id: 'habit-1',
      userId: 'user-1',
      logDate: '2026-01-03',
      currentStreak: 4,
      longestStreak: 9,
      daysLoggedLast7: 6,
      lastLogDate: '2026-01-03',
      createdAt: '2026-01-03T22:00:00.000Z',
    })
  })

  it('maps creature preview and battle hub payloads', () => {
    expect(
      mapCreaturePreview({
        tomorrow_readiness_score: 78,
        tomorrow_readiness_band: 'ready',
        projected_strength: 74,
        projected_resilience: 71,
        projected_momentum: 79,
        projected_vitality: 101,
        meal_rating: 'strong',
        meal_feedback_message: 'Strong meal.',
      }),
    ).toEqual({
      tomorrowReadinessScore: 78,
      tomorrowReadinessBand: 'ready',
      projectedStrength: 74,
      projectedResilience: 71,
      projectedMomentum: 79,
      projectedVitality: 101,
      mealRating: 'strong',
      mealFeedbackMessage: 'Strong meal.',
    })

    expect(
      mapBattleHub({
        companion: {
          user_id: 'user-1',
          name: 'Sprout',
          stage: 'adult',
          level: 4,
          xp: 340,
          current_condition: 'thriving',
          hatched_at: '2026-01-01T00:00:00.000Z',
          evolved_to_adult_at: '2026-01-07T00:00:00.000Z',
          evolved_to_champion_at: null,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-08T00:00:00.000Z',
        },
        snapshot: {
          id: 'snapshot-1',
          user_id: 'user-1',
          prep_date: '2026-01-07',
          battle_date: '2026-01-08',
          strength: 72,
          resilience: 68,
          momentum: 74,
          vitality: 96,
          readiness_score: 75,
          readiness_band: 'ready',
          condition: 'thriving',
          level: 4,
          stage: 'adult',
          source_daily_evaluation_id: 'eval-1',
          xp_gained: 18,
          created_at: '2026-01-07T23:00:00.000Z',
        },
        recommended_opponent: {
          opponent_id: 'opp-1',
          name: 'Pebble Pup',
          archetype: 'steady bruiser',
          recommended_level: 2,
          likely_outcome: 'favored',
        },
        unlocked_opponents: [
          {
            id: 'opp-1',
            arena_id: 'arena-1',
            name: 'Pebble Pup',
            archetype: 'steady bruiser',
            recommended_level: 2,
            strength: 42,
            resilience: 45,
            momentum: 38,
            vitality: 78,
            sort_order: 1,
            unlock_level: 1,
            is_active: true,
            created_at: '2026-01-01T00:00:00.000Z',
          },
        ],
        battle_history: [
          {
            id: 'run-1',
            user_id: 'user-1',
            battle_date: '2026-01-08',
            snapshot_id: 'snapshot-1',
            opponent_id: 'opp-1',
            outcome: 'win',
            turn_count: 4,
            remaining_hp_pct: 61,
            xp_awarded: 18,
            arena_progress_awarded: 1,
            reward_claimed: true,
            created_at: '2026-01-08T09:00:00.000Z',
            opponent: {
              id: 'opp-1',
              arena_id: 'arena-1',
              name: 'Pebble Pup',
              archetype: 'steady bruiser',
              recommended_level: 2,
              strength: 42,
              resilience: 45,
              momentum: 38,
              vitality: 78,
              sort_order: 1,
              unlock_level: 1,
              is_active: true,
              created_at: '2026-01-01T00:00:00.000Z',
            },
          },
        ],
      }),
    ).toEqual({
      companion: expect.objectContaining({
        name: 'Sprout',
        stage: 'adult',
        currentCondition: 'thriving',
      }),
      snapshot: expect.objectContaining({
        battleDate: '2026-01-08',
        readinessBand: 'ready',
      }),
      recommendedOpponent: expect.objectContaining({
        opponentId: 'opp-1',
        likelyOutcome: 'favored',
      }),
      unlockedOpponents: [expect.objectContaining({ id: 'opp-1', unlockLevel: 1 })],
      battleHistory: [expect.objectContaining({ id: 'run-1', rewardClaimed: true })],
    })
  })
})
