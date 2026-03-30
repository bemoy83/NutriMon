import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import QuickAddSheet from '../QuickAddSheet'

const createMealWithItemsMock = vi.fn()
const invalidateDailyLogMock = vi.fn()
const invalidateProductsMock = vi.fn()

vi.mock('../api', () => ({
  createMealWithItems: (...args: unknown[]) => createMealWithItemsMock(...args),
}))

vi.mock('../useDailyLog', () => ({
  useInvalidateDailyLog: () => invalidateDailyLogMock,
}))

vi.mock('../queryInvalidation', () => ({
  useInvalidateProductQueries: () => invalidateProductsMock,
}))

vi.mock('../useFoodSources', () => ({
  useRecentFoodSources: () => ({
    data: [
      {
        sourceType: 'user_product',
        sourceId: 'product-1',
        name: 'My oats',
        calories: 220,
        proteinG: 8,
        carbsG: 40,
        fatG: 4,
        defaultServingAmount: 1,
        defaultServingUnit: 'bowl',
        useCount: 3,
        lastUsedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  }),
  useFrequentFoodSources: () => ({ data: [] }),
  useFoodSourceSearch: () => ({ data: [] }),
}))

describe('QuickAddSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createMealWithItemsMock.mockResolvedValue({
      meal: {
        id: 'meal-1',
        daily_log_id: 'log-1',
        logged_at: '2026-01-05T08:00:00.000Z',
        total_calories: 220,
        item_count: 1,
      },
      meal_items: [],
      daily_log: {
        id: 'log-1',
        user_id: 'user-1',
        log_date: '2026-01-05',
        total_calories: 220,
        meal_count: 1,
        is_finalized: false,
        finalized_at: null,
        created_at: '2026-01-05T00:00:00.000Z',
        updated_at: '2026-01-05T00:00:00.000Z',
      },
    })
  })

  it('adds a selected food source and confirms the meal', async () => {
    const onAdded = vi.fn()
    const onClose = vi.fn()

    render(
      <QuickAddSheet
        logDate="2026-01-05"
        loggedAt="2026-01-05T08:00:00.000Z"
        onClose={onClose}
        onAdded={onAdded}
      />,
    )

    fireEvent.click(screen.getAllByRole('button').find((button) => button.textContent === '+')!)
    fireEvent.click(screen.getByRole('button', { name: 'Add 1 item' }))

    await waitFor(() => {
      expect(createMealWithItemsMock).toHaveBeenCalledWith('2026-01-05', '2026-01-05T08:00:00.000Z', [
        { product_id: 'product-1', quantity: 1 },
      ])
      expect(invalidateDailyLogMock).toHaveBeenCalledWith('2026-01-05')
      expect(invalidateProductsMock).toHaveBeenCalled()
      expect(onAdded).toHaveBeenCalled()
      expect(onClose).toHaveBeenCalled()
    })
  })
})
