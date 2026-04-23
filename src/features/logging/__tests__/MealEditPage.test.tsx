import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MealEditPage from '@/pages/app/MealEditPage'
import type { Meal } from '@/types/domain'

const useDailyLogCoreMock = vi.fn()
const updateMealWithItemsMock = vi.fn()
const deleteMealMock = vi.fn()
const invalidateDailyLogMock = vi.fn()
const invalidateProductsMock = vi.fn()
const useFoodSourceMapMock = vi.fn()

vi.mock('@/features/logging/useDailyLogCore', () => ({
  useDailyLogCore: (...args: unknown[]) => useDailyLogCoreMock(...args),
}))

vi.mock('@/features/logging/api', () => ({
  updateMealWithItems: (...args: unknown[]) => updateMealWithItemsMock(...args),
  deleteMeal: (...args: unknown[]) => deleteMealMock(...args),
}))

vi.mock('@/features/logging/useDailyLog', () => ({
  useInvalidateDailyLog: () => invalidateDailyLogMock,
}))

vi.mock('@/features/logging/queryInvalidation', () => ({
  useInvalidateProductQueries: () => invalidateProductsMock,
}))

vi.mock('@/features/logging/useFoodSources', () => ({
  useFoodSourceMap: (...args: unknown[]) => useFoodSourceMapMock(...args),
}))

vi.mock('@/features/logging/MealSheet', () => ({
  default: ({
    onItemsSelected,
    onClose,
  }: {
    onItemsSelected?: (items: unknown[]) => void
    onClose: () => void
  }) => (
    <div>
      <div>mock-meal-sheet</div>
      <button
        type="button"
        onClick={() => {
          onItemsSelected?.([
            {
              productId: 'product-1',
              quantity: 2,
              snapshotName: 'Oats',
              snapshotCalories: 100,
              snapshotServingAmount: 100,
              snapshotServingUnit: 'g',
              foodSource: {
                sourceType: 'user_product',
                sourceId: 'product-1',
                name: 'Oats',
                calories: 100,
                caloriesPer100g: 100,
                proteinG: 10,
                carbsG: 50,
                fatG: 5,
                defaultServingAmount: 100,
                defaultServingUnit: 'g',
                labelPortionGrams: null,
                useCount: 0,
                lastUsedAt: null,
                kind: 'simple',
                pieceCount: null,
                pieceLabel: null,
                totalMassG: null,
              },
            },
          ])
          onClose()
        }}
      >
        add-duplicate-food
      </button>
    </div>
  ),
}))

const meal: Meal = {
  id: 'meal-1',
  userId: 'user-1',
  dailyLogId: 'log-1',
  loggedAt: '2026-01-05T08:30:00.000Z',
  mealType: 'Breakfast',
  mealName: 'Morning bowl',
  totalCalories: 220,
  itemCount: 2,
  createdAt: '2026-01-05T08:30:00.000Z',
  updatedAt: '2026-01-05T08:30:00.000Z',
  items: [
    {
      id: 'item-1',
      mealId: 'meal-1',
      productId: 'product-1',
      catalogItemId: null,
      quantity: 1,
      productNameSnapshot: 'Oats',
      caloriesPerServingSnapshot: 100,
      proteinGSnapshot: 10,
      carbsGSnapshot: 50,
      fatGSnapshot: 5,
      servingAmountSnapshot: 100,
      servingUnitSnapshot: 'g',
      lineTotalCalories: 100,
      createdAt: '2026-01-05T08:30:00.000Z',
    },
    {
      id: 'item-2',
      mealId: 'meal-1',
      productId: null,
      catalogItemId: null,
      quantity: 1,
      productNameSnapshot: 'Deleted Toast',
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

function LocationStateSpy() {
  const location = useLocation()
  return (
    <div>
      <div>log page</div>
      <pre data-testid="location-state">{JSON.stringify(location.state)}</pre>
    </div>
  )
}

function renderEditor(initialEntries: Array<string | { pathname: string; state?: unknown }> = ['/app/log/2026-01-05/meal/meal-1/edit']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/app/log/:date/meal/:mealId/edit" element={<MealEditPage />} />
        <Route path="/app/log/:date" element={<LocationStateSpy />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('MealEditPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    invalidateDailyLogMock.mockReset()
    invalidateProductsMock.mockReset()
    useFoodSourceMapMock.mockReturnValue({
      data: {
        'user_product:product-1': {
          sourceType: 'user_product',
          sourceId: 'product-1',
          name: 'Oats',
          calories: 100,
          caloriesPer100g: 100,
          proteinG: 10,
          carbsG: 50,
          fatG: 5,
          defaultServingAmount: 40,
          defaultServingUnit: 'portion',
          labelPortionGrams: 40,
          useCount: 0,
          lastUsedAt: null,
          kind: 'simple',
          pieceCount: null,
          pieceLabel: null,
          totalMassG: null,
        },
      },
    })
    updateMealWithItemsMock.mockResolvedValue({
      meal: {
        id: 'meal-1',
        daily_log_id: 'log-1',
        logged_at: '2026-01-05T08:30:00.000Z',
        meal_type: 'Breakfast',
        meal_name: 'Morning bowl',
        total_calories: 270,
        item_count: 2,
      },
      meal_items: [],
      daily_log: {
        id: 'log-1',
        user_id: 'user-1',
        log_date: '2026-01-05',
        total_calories: 270,
        meal_count: 1,
        is_finalized: false,
        finalized_at: null,
        created_at: '2026-01-05T00:00:00.000Z',
        updated_at: '2026-01-05T00:00:00.000Z',
      },
      creature_preview: {
        tomorrow_readiness_score: 72,
        tomorrow_readiness_band: 'ready',
        projected_strength: 70,
        projected_resilience: 69,
        projected_momentum: 71,
        projected_vitality: 95,
        meal_rating: 'strong',
        meal_feedback_message: 'Updated preview',
      },
    })
    deleteMealMock.mockResolvedValue({
      deleted_meal_id: 'meal-1',
      daily_log: {
        id: 'log-1',
        user_id: 'user-1',
        log_date: '2026-01-05',
        total_calories: 0,
        meal_count: 0,
        is_finalized: false,
        finalized_at: null,
        created_at: '2026-01-05T00:00:00.000Z',
        updated_at: '2026-01-05T00:00:00.000Z',
      },
      creature_preview: {
        tomorrow_readiness_score: 54,
        tomorrow_readiness_band: 'building',
        projected_strength: 52,
        projected_resilience: 51,
        projected_momentum: 55,
        projected_vitality: 80,
        meal_rating: 'solid',
        meal_feedback_message: 'Delete preview',
      },
    })
  })

  it('renders loading state while the meal query is loading', () => {
    useDailyLogCoreMock.mockReturnValue({
      data: null,
      isLoading: true,
    })

    renderEditor()

    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('redirects to the daily log when the meal is missing', async () => {
    useDailyLogCoreMock.mockReturnValue({
      data: {
        dailyLog: null,
        meals: [],
      },
      isLoading: false,
    })

    renderEditor()

    expect(await screen.findByText('log page')).toBeInTheDocument()
  })

  it('hydrates local state after the meal query resolves', async () => {
    let queryResult: { data: unknown; isLoading: boolean } = {
      data: null,
      isLoading: true,
    }
    useDailyLogCoreMock.mockImplementation(() => queryResult)

    const view = renderEditor()
    expect(screen.getByText('Loading…')).toBeInTheDocument()

    queryResult = {
      data: {
        dailyLog: null,
        meals: [meal],
      },
      isLoading: false,
    }

    view.rerender(
      <MemoryRouter initialEntries={['/app/log/2026-01-05/meal/meal-1/edit']}>
        <Routes>
          <Route path="/app/log/:date/meal/:mealId/edit" element={<MealEditPage />} />
          <Route path="/app/log/:date" element={<LocationStateSpy />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByDisplayValue('Morning bowl')).toBeInTheDocument()
    expect(screen.getByText('100g · 100 kcal')).toBeInTheDocument()
  })

  it('opens serving edit, updates kcal, deletes items, and replaces duplicate added foods', async () => {
    useDailyLogCoreMock.mockReturnValue({
      data: {
        dailyLog: null,
        meals: [meal],
      },
      isLoading: false,
    })

    renderEditor()

    fireEvent.click(screen.getByRole('button', { name: /100g .*100 kcal/ }))
    expect(screen.getByRole('dialog', { name: 'Oats' })).toBeInTheDocument()

    const gramsInput = screen.getByRole('textbox', { name: 'Grams' })
    fireEvent.focus(gramsInput)
    fireEvent.change(gramsInput, { target: { value: '150' } })
    fireEvent.keyDown(gramsInput, { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Update' }))

    expect(await screen.findByText('150g · 150 kcal')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Delete Deleted Toast (deleted)' }))
    await waitFor(() => {
      expect(screen.queryByText(/Deleted Toast/)).not.toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Add food/ }))
    expect(screen.getByText('mock-meal-sheet')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'add-duplicate-food' }))

    expect(await screen.findByText('200g · 200 kcal')).toBeInTheDocument()
    expect(screen.getAllByText('Oats')).toHaveLength(1)
  })

  it('reuses the serving step UI for snapshot-only meal items', async () => {
    useDailyLogCoreMock.mockReturnValue({
      data: {
        dailyLog: null,
        meals: [meal],
      },
      isLoading: false,
    })

    renderEditor()

    fireEvent.click(screen.getByText('Deleted Toast (deleted)').closest('button')!)

    expect(screen.getByRole('dialog', { name: 'Deleted Toast (deleted)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to food list' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Pieces' })).toBeInTheDocument()
    expect(screen.getByText('Unit: slice')).toBeInTheDocument()
  })

  it('hydrates linked products so serving step shows the segmented picker', async () => {
    useDailyLogCoreMock.mockReturnValue({
      data: {
        dailyLog: null,
        meals: [meal],
      },
      isLoading: false,
    })

    renderEditor()

    fireEvent.click(screen.getByText('Oats').closest('button')!)

    expect(screen.getByRole('dialog', { name: 'Oats' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Grams' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Portions' })).toBeInTheDocument()
  })

  it('saves with the existing update payload shape and navigates back with state', async () => {
    useDailyLogCoreMock.mockReturnValue({
      data: {
        dailyLog: null,
        meals: [meal],
      },
      isLoading: false,
    })

    renderEditor()

    fireEvent.click(screen.getByRole('button', { name: /100g .*100 kcal/ }))
    const gramsInput = screen.getByRole('textbox', { name: 'Grams' })
    fireEvent.focus(gramsInput)
    fireEvent.change(gramsInput, { target: { value: '150' } })
    fireEvent.keyDown(gramsInput, { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Update' }))

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(updateMealWithItemsMock).toHaveBeenCalledWith(
        'meal-1',
        '2026-01-05T08:30:00.000Z',
        [
          {
            product_id: 'product-1',
            quantity: 1.5,
          },
          {
            meal_item_id: 'item-2',
            quantity: 1,
            product_name_snapshot: 'Deleted Toast',
            calories_per_serving_snapshot: 120,
            protein_g_snapshot: 4,
            carbs_g_snapshot: 18,
            fat_g_snapshot: 2,
            serving_amount_snapshot: 1,
            serving_unit_snapshot: 'slice',
          },
        ],
        'Breakfast',
        'Morning bowl',
      )
      expect(invalidateDailyLogMock).toHaveBeenCalledWith('2026-01-05')
      expect(invalidateProductsMock).toHaveBeenCalled()
    })

    expect(await screen.findByText('log page')).toBeInTheDocument()
    expect(screen.getByTestId('location-state').textContent).toContain('"kind":"saved"')
  })

  it('confirms before deleting and navigates back with undo state', async () => {
    useDailyLogCoreMock.mockReturnValue({
      data: {
        dailyLog: null,
        meals: [meal],
      },
      isLoading: false,
    })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Meal options' }))
    const optionsSheet = await screen.findByRole('dialog', { name: 'Meal options' })
    fireEvent.click(within(optionsSheet).getByRole('button', { name: 'Delete meal' }))

    await waitFor(() => {
      expect(deleteMealMock).toHaveBeenCalledWith('meal-1')
      expect(invalidateDailyLogMock).toHaveBeenCalledWith('2026-01-05')
      expect(invalidateProductsMock).toHaveBeenCalled()
    })

    expect(confirmSpy).toHaveBeenCalled()
    expect(await screen.findByText('log page')).toBeInTheDocument()
    expect(screen.getByTestId('location-state').textContent).toContain('"kind":"deleted"')

    confirmSpy.mockRestore()
  })
})
