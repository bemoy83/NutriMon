import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MealEditSheet from '../MealEditSheet'
import type { Meal } from '@/types/domain'

const updateMealWithItemsMock = vi.fn()
const invalidateDailyLogMock = vi.fn()
const invalidateProductsMock = vi.fn()

vi.mock('../api', () => ({
  updateMealWithItems: (...args: unknown[]) => updateMealWithItemsMock(...args),
}))

vi.mock('../useDailyLog', () => ({
  useInvalidateDailyLog: () => invalidateDailyLogMock,
}))

vi.mock('../queryInvalidation', () => ({
  useInvalidateProductQueries: () => invalidateProductsMock,
}))

vi.mock('../useFoodSources', () => ({
  useRecentFoodSources: () => ({ data: [] }),
  useFrequentFoodSources: () => ({ data: [] }),
  useFoodSourceSearch: () => ({ data: [] }),
}))

const meal: Meal = {
  id: 'meal-1',
  userId: 'user-1',
  dailyLogId: 'log-1',
  loggedAt: '2026-01-05T08:30:00.000Z',
  totalCalories: 120,
  itemCount: 1,
  createdAt: '2026-01-05T08:30:00.000Z',
  updatedAt: '2026-01-05T08:30:00.000Z',
  items: [
    {
      id: 'item-1',
      mealId: 'meal-1',
      productId: null,
      catalogItemId: null,
      quantity: 1,
      productNameSnapshot: 'Deleted toast',
      caloriesPerServingSnapshot: 120,
      proteinGSnapshot: 4,
      carbsGSnapshot: 18,
      fatGSnapshot: 2,
      servingAmountSnapshot: 1,
      servingUnitSnapshot: 'slice',
      lineTotalCalories: 120,
      createdAt: '2026-01-05T08:30:00.000Z',
    },
  ],
}

describe('MealEditSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateMealWithItemsMock.mockResolvedValue({})
  })

  it('keeps snapshot-only items editable when saving', async () => {
    const onSaved = vi.fn()
    const onClose = vi.fn()

    render(<MealEditSheet meal={meal} logDate="2026-01-05" onClose={onClose} onSaved={onSaved} />)

    fireEvent.click(screen.getByRole('button', { name: '1g' }))
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '2' } })
    fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(updateMealWithItemsMock).toHaveBeenCalledWith('meal-1', '2026-01-05T08:30:00.000Z', [
        {
          meal_item_id: 'item-1',
          quantity: 2,
          product_name_snapshot: 'Deleted toast',
          calories_per_serving_snapshot: 120,
          protein_g_snapshot: 4,
          carbs_g_snapshot: 18,
          fat_g_snapshot: 2,
          serving_amount_snapshot: 1,
          serving_unit_snapshot: 'slice',
        },
      ])
      expect(invalidateDailyLogMock).toHaveBeenCalledWith('2026-01-05')
      expect(invalidateProductsMock).toHaveBeenCalled()
      expect(onSaved).toHaveBeenCalled()
      expect(onClose).toHaveBeenCalled()
    })
  })
})
