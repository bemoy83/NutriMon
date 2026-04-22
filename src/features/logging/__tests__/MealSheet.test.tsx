import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MealSheet from '../MealSheet'

const createMealWithItemsMock = vi.fn()
const deleteMealTemplateMock = vi.fn()
const invalidateDailyLogMock = vi.fn()
const invalidateProductsMock = vi.fn()
const invalidateTemplatesMock = vi.fn()

vi.mock('../api', () => ({
  createMealWithItems: (...args: unknown[]) => createMealWithItemsMock(...args),
  deleteMealTemplate: (...args: unknown[]) => deleteMealTemplateMock(...args),
}))

vi.mock('../useDailyLog', () => ({
  useInvalidateDailyLog: () => invalidateDailyLogMock,
}))

vi.mock('../queryInvalidation', () => ({
  useInvalidateProductQueries: () => invalidateProductsMock,
  useInvalidateMealTemplates: () => invalidateTemplatesMock,
}))

vi.mock('../useFoodSources', () => ({
  useRecentFoodSources: () => ({
    data: [
      {
        sourceType: 'user_product',
        sourceId: 'product-1',
        name: 'My oats',
        calories: 220,
        caloriesPer100g: 220,
        proteinG: 8,
        carbsG: 40,
        fatG: 4,
        defaultServingAmount: 100,
        defaultServingUnit: 'g',
        labelPortionGrams: null,
        useCount: 3,
        lastUsedAt: '2026-01-01T00:00:00.000Z',
        kind: 'simple',
        pieceCount: null,
        pieceLabel: null,
        totalMassG: null,
      },
    ],
  }),
  useFoodSourceSearch: () => ({ data: [], isPending: false }),
}))

vi.mock('../useMealTemplates', () => ({
  useMealTemplates: () => ({ data: [] }),
}))

const mealMutationResult = {
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
}

describe('MealSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createMealWithItemsMock.mockResolvedValue(mealMutationResult)
  })

  it('tapping a food opens the serving step with live kcal', async () => {
    render(
      <MealSheet
        logDate="2026-01-05"
        loggedAt="2026-01-05T08:00:00.000Z"
        onClose={vi.fn()}
        onAdded={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'My oats' }))

    expect(screen.getByText('220')).toBeInTheDocument()
    expect(screen.getByText('kcal')).toBeInTheDocument()
  })

  it('confirms serving and then logs the meal', async () => {
    const onAdded = vi.fn()
    const onClose = vi.fn()

    render(
      <MealSheet
        logDate="2026-01-05"
        loggedAt="2026-01-05T08:00:00.000Z"
        onClose={onClose}
        onAdded={onAdded}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'My oats' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add to Breakfast' }))
    fireEvent.click(screen.getByRole('button', { name: /Add to Breakfast · 1 item/ }))

    await waitFor(() => {
      expect(createMealWithItemsMock).toHaveBeenCalledWith(
        '2026-01-05',
        '2026-01-05T08:00:00.000Z',
        [{ product_id: 'product-1', quantity: 1 }],
        'Breakfast',
      )
      expect(invalidateDailyLogMock).toHaveBeenCalledWith('2026-01-05')
      expect(invalidateProductsMock).toHaveBeenCalled()
      expect(onAdded).toHaveBeenCalled()
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('returns selected items without calling create when onItemsSelected is provided', async () => {
    const onItemsSelected = vi.fn()
    const onClose = vi.fn()

    render(
      <MealSheet
        logDate="2026-01-05"
        loggedAt="2026-01-05T08:00:00.000Z"
        onClose={onClose}
        onItemsSelected={onItemsSelected}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'My oats' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add to Breakfast' }))
    fireEvent.click(screen.getByRole('button', { name: /Add to Breakfast · 1 item/ }))

    await waitFor(() => {
      expect(onItemsSelected).toHaveBeenCalledWith([
        expect.objectContaining({
          productId: 'product-1',
          quantity: 1,
          snapshotName: 'My oats',
        }),
      ])
      expect(createMealWithItemsMock).not.toHaveBeenCalled()
      expect(onClose).toHaveBeenCalled()
    })
  })
})
