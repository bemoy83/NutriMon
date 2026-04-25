import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import MealSlots from '../MealSlots'
import type { Meal } from '@/types/domain'

const updateMealWithItemsMock = vi.fn()
const invalidateDailyLogMock = vi.fn()
const invalidateProductsMock = vi.fn()
const invalidateTemplatesMock = vi.fn()

vi.mock('../api', () => ({
  deleteMeal: vi.fn(),
  saveMealAsTemplate: vi.fn(),
  updateMealWithItems: (...args: unknown[]) => updateMealWithItemsMock(...args),
}))

vi.mock('../useDailyLog', () => ({
  useInvalidateDailyLog: () => invalidateDailyLogMock,
}))

vi.mock('../queryInvalidation', () => ({
  useInvalidateMealTemplates: () => invalidateTemplatesMock,
  useInvalidateProductQueries: () => invalidateProductsMock,
}))

const meal: Meal = {
  id: 'meal-1',
  userId: 'user-1',
  dailyLogId: 'log-1',
  loggedAt: '2026-01-05T08:30:00.000Z',
  mealType: 'Breakfast',
  mealName: null,
  totalCalories: 328,
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
      productNameSnapshot: 'Knekkebrod m/egg',
      caloriesPerServingSnapshot: 328,
      proteinGSnapshot: 18,
      carbsGSnapshot: 12,
      fatGSnapshot: 22,
      servingAmountSnapshot: 160,
      servingUnitSnapshot: 'piece',
      lineTotalCalories: 328,
      createdAt: '2026-01-05T08:30:00.000Z',
    },
  ],
}

describe('MealSlots', () => {
  it('opens the serving bottom sheet from a logged meal row', () => {
    render(
      <MealSlots
        meals={[meal]}
        isFinalized={false}
        timezone="UTC"
        logDate="2026-01-05"
        onAddToSlot={vi.fn()}
        onUpdateSuccess={vi.fn()}
        onDeleteSuccess={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByText('Breakfast'))
    expect(screen.getByText('1 piece')).toBeInTheDocument()
    expect(screen.queryByText('160piece')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Adjust serving for Knekkebrod m/egg' }))

    expect(screen.getByRole('dialog', { name: 'Knekkebrod m/egg (deleted)' })).toBeInTheDocument()
  })
})
