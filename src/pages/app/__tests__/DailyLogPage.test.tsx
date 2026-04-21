import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DailyLogPage from '../DailyLogPage'
import type { Meal } from '@/types/domain'
import type { DeleteMealResult, MealMutationResult } from '@/types/database'

const useDailyLogCoreMock = vi.fn()
const useDailyLogDerivedMock = vi.fn()
const useLatestFallbackMetricsMock = vi.fn()
const useInvalidateDailyLogMock = vi.fn()
const useAuthMock = vi.fn()
const useProfileSummaryMock = vi.fn()
const useRepeatLastMealPreviewMock = vi.fn()
const useDailyLogHeaderCompactMock = vi.fn()
const repeatLastMealMock = vi.fn()
const deleteMealMock = vi.fn()
const deleteMealItemMock = vi.fn()
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

vi.mock('@/features/logging/useRepeatLastMealPreview', () => ({
  useRepeatLastMealPreview: (...args: unknown[]) => useRepeatLastMealPreviewMock(...args),
}))

vi.mock('@/features/logging/useDailyLogHeaderCompact', () => ({
  useDailyLogHeaderCompact: (...args: unknown[]) => useDailyLogHeaderCompactMock(...args),
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
  deleteMealItem: (...args: unknown[]) => deleteMealItemMock(...args),
  repeatLastMeal: (...args: unknown[]) => repeatLastMealMock(...args),
  restoreMealFromSnapshot: (...args: unknown[]) => restoreMealFromSnapshotMock(...args),
  updateMealWithItems: (...args: unknown[]) => updateMealWithItemsMock(...args),
}))

vi.mock('@/features/logging/MealSheet', () => ({
  default: ({
    mode,
    meal,
    onSaved,
    onAdded,
  }: {
    mode: 'add' | 'edit'
    meal?: Meal
    onSaved?: (meal: Meal, result: MealMutationResult) => void
    onAdded?: (result: MealMutationResult) => void
  }) => {
    if (mode === 'add') {
      return (
        <div>
          <div>quick-add-sheet</div>
          <button
            type="button"
            onClick={() =>
              onAdded?.({
                meal: {
                  id: 'meal-lunch',
                  daily_log_id: 'log-1',
                  logged_at: '2026-01-05T12:00:00.000Z',
                  meal_type: 'Lunch',
                  meal_name: null,
                  total_calories: 220,
                  item_count: 1,
                },
                meal_items: [],
                inserted_meal_item_ids: ['appended-item-1', 'appended-item-2'],
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
            }
          >
            simulate-append-add
          </button>
          <button
            type="button"
            onClick={() =>
              onAdded?.({
                meal: {
                  id: 'meal-new',
                  daily_log_id: 'log-1',
                  logged_at: '2026-01-05T08:00:00.000Z',
                  meal_type: 'Breakfast',
                  meal_name: null,
                  total_calories: 100,
                  item_count: 1,
                },
                meal_items: [],
                daily_log: {
                  id: 'log-1',
                  user_id: 'user-1',
                  log_date: '2026-01-05',
                  total_calories: 100,
                  meal_count: 1,
                  is_finalized: false,
                  finalized_at: null,
                  created_at: '2026-01-05T00:00:00.000Z',
                  updated_at: '2026-01-05T00:00:00.000Z',
                },
              })
            }
          >
            simulate-new-meal-no-ids
          </button>
        </div>
      )
    }
    return (
      <button
        type="button"
        onClick={() =>
          onSaved?.(meal!, {
            meal: {
              id: meal!.id,
              daily_log_id: meal!.dailyLogId,
              logged_at: meal!.loggedAt,
              meal_type: meal!.mealType,
              meal_name: meal!.mealName,
              total_calories: meal!.totalCalories,
              item_count: meal!.itemCount,
            },
            meal_items: [],
            daily_log: {
              id: 'log-1',
              user_id: 'user-1',
              log_date: '2026-01-05',
              total_calories: 520,
              meal_count: 1,
              is_finalized: false,
              finalized_at: null,
              created_at: '2026-01-05T00:00:00.000Z',
              updated_at: '2026-01-05T00:00:00.000Z',
            },
            creature_preview: {
              tomorrow_readiness_score: 71,
              tomorrow_readiness_band: 'ready',
              projected_strength: 69,
              projected_resilience: 68,
              projected_momentum: 72,
              projected_vitality: 94,
              meal_rating: 'strong',
              meal_feedback_message: 'Preview updated after edit.',
            },
          })
        }
      >
        save-edit
      </button>
    )
  },
}))

vi.mock('@/features/logging/MealSlots', () => ({
  default: ({
    meals,
    onDeleteSuccess,
    onEditMeal,
  }: {
    meals: Meal[]
    onDeleteSuccess: (meal: Meal, result: DeleteMealResult) => void
    onEditMeal: (meal: Meal) => void
  }) => (
    <div data-testid="meal-slots-mock">
      {meals.length === 0 ? (
        <p>Nothing logged yet</p>
      ) : (
        <>
          <button
            type="button"
            onClick={() =>
              onDeleteSuccess(meals[0], {
                deleted_meal_id: meals[0].id,
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
                  tomorrow_readiness_score: 58,
                  tomorrow_readiness_band: 'building',
                  projected_strength: 56,
                  projected_resilience: 55,
                  projected_momentum: 59,
                  projected_vitality: 82,
                  meal_rating: 'solid',
                  meal_feedback_message: 'Preview updated after delete.',
                },
              })
            }
          >
            trigger-delete
          </button>
          <button type="button" onClick={() => onEditMeal(meals[0])}>
            trigger-edit
          </button>
        </>
      )}
    </div>
  ),
}))

const baseMeal: Meal = {
  id: 'meal-1',
  userId: 'user-1',
  dailyLogId: 'log-1',
  loggedAt: '2026-01-05T08:30:00.000Z',
  mealType: 'Breakfast',
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
    deleteMealItemMock.mockResolvedValue({
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
      meal: null,
    })
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
      creature_preview: {
        tomorrow_readiness_score: 83,
        tomorrow_readiness_band: 'ready',
        projected_strength: 80,
        projected_resilience: 78,
        projected_momentum: 82,
        projected_vitality: 101,
        meal_rating: 'strong',
        meal_feedback_message: "This is pushing tomorrow's prep in a strong direction. Keep the same steady rhythm.",
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
    useRepeatLastMealPreviewMock.mockReturnValue({ data: null, isLoading: false })
    useDailyLogHeaderCompactMock.mockReturnValue(false)
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

    expect(screen.getByRole('heading', { name: 'Meals' })).toBeInTheDocument()
    expect(screen.getByTestId('meal-slots-mock')).toBeInTheDocument()
    expect(screen.getByText('Nothing logged yet')).toBeInTheDocument()
    expect(screen.queryByText('quick-add-sheet')).not.toBeInTheDocument()
    expect(screen.queryByText('Finalize & Prep')).not.toBeInTheDocument()
  })

  it('shows finalize for past unfinalized days that already have meals', async () => {
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
    useRepeatLastMealPreviewMock.mockReturnValue({
      data: { mealName: 'Protein bowl', mealType: 'lunch', totalCalories: 520 },
      isLoading: false,
    })
    getTodayInTimezoneMock.mockReturnValue('2026-01-06')

    renderPage()

    expect(screen.getByText('Finalize & Prep')).toBeInTheDocument()
    expect(screen.queryByText('Copy previous meal')).not.toBeInTheDocument()
  })

  it('keeps a single persistent page heading when the compact summary is shown', () => {
    useDailyLogHeaderCompactMock.mockReturnValue(true)
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

    expect(screen.getByRole('heading', { name: '2026-01-05' })).toBeInTheDocument()
    expect(screen.getAllByText('2026-01-05')).toHaveLength(1)
    expect(screen.getByText('520 eaten · goal 2,000')).toBeInTheDocument()
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
        'Breakfast',
        null,
      )
    })
  })

  it('does not offer undo after editing a meal', async () => {
    const invalidate = vi.fn()
    useInvalidateDailyLogMock.mockReturnValue(invalidate)

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

    expect(screen.queryByText('Meal updated')).not.toBeInTheDocument()
    expect(screen.queryByText('Undo')).not.toBeInTheDocument()
    expect(updateMealWithItemsMock).not.toHaveBeenCalled()
    expect(invalidate).toHaveBeenCalledWith('2026-01-05')
  })

  it('does not show undo after inline quick add (append)', async () => {
    const invalidate = vi.fn()
    useInvalidateDailyLogMock.mockReturnValue(invalidate)

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

    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Add food to meal slot' }))
    fireEvent.click(await screen.findByText('simulate-append-add'))

    expect(screen.queryByText('Undo')).not.toBeInTheDocument()
    expect(deleteMealItemMock).not.toHaveBeenCalled()
    expect(deleteMealMock).not.toHaveBeenCalled()
    expect(invalidate).toHaveBeenCalledWith('2026-01-05')
  })

  it('does not show undo after inline quick add (new meal, no inserted ids)', async () => {
    const invalidate = vi.fn()
    useInvalidateDailyLogMock.mockReturnValue(invalidate)

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

    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Add food to meal slot' }))
    fireEvent.click(await screen.findByText('simulate-new-meal-no-ids'))

    expect(screen.queryByText('Undo')).not.toBeInTheDocument()
    expect(deleteMealMock).not.toHaveBeenCalled()
    expect(deleteMealItemMock).not.toHaveBeenCalled()
    expect(invalidate).toHaveBeenCalledWith('2026-01-05')
  })
})
