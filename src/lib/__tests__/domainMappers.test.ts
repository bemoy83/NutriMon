import { describe, expect, it } from 'vitest'
import {
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
})
