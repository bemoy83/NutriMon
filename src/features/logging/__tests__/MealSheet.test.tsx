import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MealSheet from '../MealSheet'
import type { Meal } from '@/types/domain'

const createMealWithItemsMock = vi.fn()
const updateMealWithItemsMock = vi.fn()
const deleteMealTemplateMock = vi.fn()
const invalidateDailyLogMock = vi.fn()
const invalidateProductsMock = vi.fn()
const invalidateTemplatesMock = vi.fn()

vi.mock('../api', () => ({
  createMealWithItems: (...args: unknown[]) => createMealWithItemsMock(...args),
  updateMealWithItems: (...args: unknown[]) => updateMealWithItemsMock(...args),
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
        proteinG: 8,
        carbsG: 40,
        fatG: 4,
        defaultServingAmount: 100,
        defaultServingUnit: 'g',
        useCount: 3,
        lastUsedAt: '2026-01-01T00:00:00.000Z',
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

describe('MealSheet — add mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createMealWithItemsMock.mockResolvedValue(mealMutationResult)
  })

  it('tapping a food opens the serving step with live kcal', async () => {
    render(
      <MealSheet
        mode="add"
        logDate="2026-01-05"
        loggedAt="2026-01-05T08:00:00.000Z"
        onClose={vi.fn()}
        onAdded={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'My oats' }))
    // Serving step is now visible
    expect(screen.getByText('220')).toBeInTheDocument() // 100g × 220kcal/100g = 220 kcal
    expect(screen.getByText('kcal')).toBeInTheDocument()
  })

  it('confirms serving and then logs the meal', async () => {
    const onAdded = vi.fn()
    const onClose = vi.fn()

    render(
      <MealSheet
        mode="add"
        logDate="2026-01-05"
        loggedAt="2026-01-05T08:00:00.000Z"
        onClose={onClose}
        onAdded={onAdded}
      />,
    )

    // Tap food → serving step
    fireEvent.click(screen.getByRole('button', { name: 'My oats' }))
    // Confirm serving (default 100g)
    fireEvent.click(screen.getByRole('button', { name: 'Add to Breakfast' }))
    // Back in browse, submit the meal
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
})

const snapshotMeal: Meal = {
  id: 'meal-1',
  userId: 'user-1',
  dailyLogId: 'log-1',
  loggedAt: '2026-01-05T08:30:00.000Z',
  mealType: null,
  mealName: null,
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

describe('MealSheet — edit mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateMealWithItemsMock.mockResolvedValue(mealMutationResult)
  })

  it('keeps snapshot-only items editable when saving', async () => {
    const onSaved = vi.fn()
    const onClose = vi.fn()

    render(
      <MealSheet
        mode="edit"
        meal={snapshotMeal}
        logDate="2026-01-05"
        loggedAt="2026-01-05T08:30:00.000Z"
        onClose={onClose}
        onSaved={onSaved}
      />,
    )

    // Edit grams in the cart bar (expand first)
    fireEvent.click(screen.getByRole('button', { name: /1 item/ }))
    const gramsInput = screen.getByRole('textbox', { name: 'Grams' })
    fireEvent.focus(gramsInput)
    fireEvent.change(gramsInput, { target: { value: '2' } })
    fireEvent.keyDown(gramsInput, { key: 'Enter' })

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(updateMealWithItemsMock).toHaveBeenCalledWith(
        'meal-1',
        '2026-01-05T08:30:00.000Z',
        [
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
        ],
        'Breakfast',
        null,
      )
      expect(invalidateDailyLogMock).toHaveBeenCalledWith('2026-01-05')
      expect(invalidateProductsMock).toHaveBeenCalled()
      expect(onSaved).toHaveBeenCalled()
      expect(onClose).toHaveBeenCalled()
    })
  })
})
