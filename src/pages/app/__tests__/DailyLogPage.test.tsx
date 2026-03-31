import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DailyLogPage from '../DailyLogPage'
import type { Meal } from '@/types/domain'

const useDailyLogCoreMock = vi.fn()
const useDailyLogDerivedMock = vi.fn()
const useLatestFallbackMetricsMock = vi.fn()
const useInvalidateDailyLogMock = vi.fn()
const useAuthMock = vi.fn()
const useProfileSummaryMock = vi.fn()
const useCanRepeatLastMealMock = vi.fn()
const repeatLastMealMock = vi.fn()
const deleteMealMock = vi.fn()
const restoreMealFromSnapshotMock = vi.fn()
const updateMealWithItemsMock = vi.fn()
const getTodayInTimezoneMock = vi.fn()
const isTodayMock = vi.fn()

vi.mock('@/features/logging/useDailyLogCore', () => ({
  useDailyLogCore: (...args: unknown[]) => useDailyLogCoreMock(...args),
}))

vi.mock('@/features/logging/useDailyLogDerived', () => ({
  useDailyLogDerived: (...args: unknown[]) => useDailyLogDerivedMock(...args),
}))

vi.mock('@/features/logging/useLatestFallbackMetrics', () => ({
  useLatestFallbackMetrics: (...args: unknown[]) => useLatestFallbackMetricsMock(...args),
}))

vi.mock('@/features/logging/useDailyLog', () => ({
  useInvalidateDailyLog: () => useInvalidateDailyLogMock(),
}))

vi.mock('@/app/providers/auth', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('@/features/profile/useProfileSummary', () => ({
  useProfileSummary: () => useProfileSummaryMock(),
}))

vi.mock('@/features/logging/useCanRepeatLastMeal', () => ({
  useCanRepeatLastMeal: (...args: unknown[]) => useCanRepeatLastMealMock(...args),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}))

vi.mock('@/lib/date', () => ({
  formatDisplayDate: (value: string) => value,
  addDays: () => '2026-01-05',
  getTodayInTimezone: (...args: unknown[]) => getTodayInTimezoneMock(...args),
  isToday: (...args: unknown[]) => isTodayMock(...args),
}))

vi.mock('@/features/logging/api', () => ({
  deleteMeal: (...args: unknown[]) => deleteMealMock(...args),
  repeatLastMeal: (...args: unknown[]) => repeatLastMealMock(...args),
  restoreMealFromSnapshot: (...args: unknown[]) => restoreMealFromSnapshotMock(...args),
  updateMealWithItems: (...args: unknown[]) => updateMealWithItemsMock(...args),
}))

vi.mock('@/features/logging/QuickAddSheet', () => ({
  default: () => <div>quick-add-sheet</div>,
}))

vi.mock('@/features/logging/MealList', () => ({
  default: ({
    meals,
    onDeleteSuccess,
    onEditMeal,
  }: {
    meals: Meal[]
    onDeleteSuccess: (meal: Meal) => void
    onEditMeal: (meal: Meal) => void
  }) => (
    <div>
      <button type="button" onClick={() => onDeleteSuccess(meals[0])}>
        trigger-delete
      </button>
      <button type="button" onClick={() => onEditMeal(meals[0])}>
        trigger-edit
      </button>
    </div>
  ),
}))

vi.mock('@/features/logging/MealEditSheet', () => ({
  default: ({
    meal,
    onSaved,
  }: {
    meal: Meal
    onSaved: (meal: Meal) => void
  }) => (
    <button type="button" onClick={() => onSaved(meal)}>
      save-edit
    </button>
  ),
}))

const baseMeal: Meal = {
  id: 'meal-1',
  userId: 'user-1',
  dailyLogId: 'log-1',
  loggedAt: '2026-01-05T08:30:00.000Z',
  mealType: null,
  mealName: null,
  totalCalories: 520,
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
      productNameSnapshot: 'Eggs',
      caloriesPerServingSnapshot: 150,
      proteinGSnapshot: 12,
      carbsGSnapshot: 1,
      fatGSnapshot: 10,
      servingAmountSnapshot: 2,
      servingUnitSnapshot: 'pcs',
      lineTotalCalories: 150,
      createdAt: '2026-01-05T08:30:00.000Z',
    },
    {
      id: 'item-2',
      mealId: 'meal-1',
      productId: null,
      catalogItemId: null,
      quantity: 1.5,
      productNameSnapshot: 'Deleted Toast',
      caloriesPerServingSnapshot: 80,
      proteinGSnapshot: 3,
      carbsGSnapshot: 15,
      fatGSnapshot: 1,
      servingAmountSnapshot: 1,
      servingUnitSnapshot: 'slice',
      lineTotalCalories: 120,
      createdAt: '2026-01-05T08:30:00.000Z',
    },
  ],
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/app/log/2026-01-05']}>
      <Routes>
        <Route path="/app/log/:date" element={<DailyLogPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('DailyLogPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthMock.mockReturnValue({ user: { id: 'user-1', email: 'user@example.com' } })
    useInvalidateDailyLogMock.mockReturnValue(vi.fn())
    getTodayInTimezoneMock.mockReturnValue('2026-01-05')
    isTodayMock.mockReturnValue(true)
    deleteMealMock.mockResolvedValue({})
    repeatLastMealMock.mockResolvedValue({
      meal: {
        id: 'meal-repeated',
        daily_log_id: 'log-1',
        logged_at: '2026-01-05T12:00:00.000Z',
        total_calories: 270,
        item_count: 1,
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
    })
    restoreMealFromSnapshotMock.mockResolvedValue({})
    updateMealWithItemsMock.mockResolvedValue({})
    useProfileSummaryMock.mockReturnValue({
      data: {
        timezone: 'UTC',
        calorieTarget: 2000,
        onboardingCompletedAt: '2026-01-01T00:00:00.000Z',
      },
      isLoading: false,
    })
    useCanRepeatLastMealMock.mockReturnValue({ data: false, isLoading: false })
    useDailyLogDerivedMock.mockReturnValue({
      data: {
        evaluation: null,
        habitMetrics: null,
        behaviorAttributes: null,
        creatureStats: null,
        feedback: null,
      },
      isLoading: false,
    })
    useLatestFallbackMetricsMock.mockReturnValue({
      data: {
        habitMetrics: null,
        creatureStats: null,
      },
      isLoading: false,
    })
  })

  it('shows the static empty-day card without blocking on derived data', () => {
    useDailyLogCoreMock.mockReturnValue({
      data: {
        dailyLog: {
          id: 'log-1',
          userId: 'user-1',
          logDate: '2026-01-05',
          totalCalories: 0,
          mealCount: 0,
          isFinalized: false,
          finalizedAt: null,
          createdAt: '2026-01-05T00:00:00.000Z',
          updatedAt: '2026-01-05T00:00:00.000Z',
        },
        meals: [],
      },
      isLoading: false,
    })
    useDailyLogDerivedMock.mockReturnValue({
      data: {
        evaluation: null,
        habitMetrics: null,
        behaviorAttributes: null,
        creatureStats: null,
        feedback: null,
      },
      isLoading: true,
    })

    renderPage()

    expect(screen.getByText('No meals logged yet.')).toBeInTheDocument()
    expect(screen.getByText('Tap + to add your first meal.')).toBeInTheDocument()
    expect(screen.queryByText('inline-quick-add')).not.toBeInTheDocument()
    expect(screen.queryByText('Finalize Day')).not.toBeInTheDocument()
  })

  it('repeats the last meal and offers undo via delete', async () => {
    useDailyLogCoreMock.mockReturnValue({
      data: {
        dailyLog: {
          id: 'log-1',
          userId: 'user-1',
          logDate: '2026-01-05',
          totalCalories: 520,
          mealCount: 1,
          isFinalized: false,
          finalizedAt: null,
          createdAt: '2026-01-05T00:00:00.000Z',
          updatedAt: '2026-01-05T00:00:00.000Z',
        },
        meals: [baseMeal],
      },
      isLoading: false,
    })
    useCanRepeatLastMealMock.mockReturnValue({ data: true, isLoading: false })
    isTodayMock.mockReturnValue(false)

    renderPage()
    fireEvent.click(screen.getByText('Repeat last meal'))

    await waitFor(() => {
      expect(repeatLastMealMock).toHaveBeenCalledWith('2026-01-05')
    })

    expect(screen.getByText('Last meal repeated')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Undo'))

    await waitFor(() => {
      expect(deleteMealMock).toHaveBeenCalledWith('meal-repeated')
    })
  })

  it('restores a deleted meal from snapshots on undo', async () => {
    useDailyLogCoreMock.mockReturnValue({
      data: {
        dailyLog: {
          id: 'log-1',
          userId: 'user-1',
          logDate: '2026-01-05',
          totalCalories: 520,
          mealCount: 1,
          isFinalized: false,
          finalizedAt: null,
          createdAt: '2026-01-05T00:00:00.000Z',
          updatedAt: '2026-01-05T00:00:00.000Z',
        },
        meals: [baseMeal],
      },
      isLoading: false,
    })

    renderPage()
    fireEvent.click(screen.getByText('trigger-delete'))

    expect(screen.getByText('Meal deleted')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Undo'))

    await waitFor(() => {
      expect(restoreMealFromSnapshotMock).toHaveBeenCalledWith(
        '2026-01-05',
        '2026-01-05T08:30:00.000Z',
        [
          {
            quantity: 1,
            product_name_snapshot: 'Eggs',
            calories_per_serving_snapshot: 150,
            protein_g_snapshot: 12,
            carbs_g_snapshot: 1,
            fat_g_snapshot: 10,
            serving_amount_snapshot: 2,
            serving_unit_snapshot: 'pcs',
          },
          {
            quantity: 1.5,
            product_name_snapshot: 'Deleted Toast',
            calories_per_serving_snapshot: 80,
            protein_g_snapshot: 3,
            carbs_g_snapshot: 15,
            fat_g_snapshot: 1,
            serving_amount_snapshot: 1,
            serving_unit_snapshot: 'slice',
          },
        ],
        null,
        null,
      )
    })
  })

  it('offers undo after editing a meal', async () => {
    useDailyLogCoreMock.mockReturnValue({
      data: {
        dailyLog: {
          id: 'log-1',
          userId: 'user-1',
          logDate: '2026-01-05',
          totalCalories: 520,
          mealCount: 1,
          isFinalized: false,
          finalizedAt: null,
          createdAt: '2026-01-05T00:00:00.000Z',
          updatedAt: '2026-01-05T00:00:00.000Z',
        },
        meals: [baseMeal],
      },
      isLoading: false,
    })

    renderPage()
    fireEvent.click(screen.getByText('trigger-edit'))
    fireEvent.click(await screen.findByText('save-edit'))

    expect(screen.getByText('Meal updated')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Undo'))

    await waitFor(() => {
      expect(updateMealWithItemsMock).toHaveBeenCalledWith(
        'meal-1',
        '2026-01-05T08:30:00.000Z',
        [
          {
            product_id: 'product-1',
            quantity: 1,
          },
          {
            meal_item_id: 'item-2',
            quantity: 1.5,
            product_name_snapshot: 'Deleted Toast',
            calories_per_serving_snapshot: 80,
            protein_g_snapshot: 3,
            carbs_g_snapshot: 15,
            fat_g_snapshot: 1,
            serving_amount_snapshot: 1,
            serving_unit_snapshot: 'slice',
          },
        ],
      )
    })
  })
})
