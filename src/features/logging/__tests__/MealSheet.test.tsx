import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MealSheet from '../MealSheet'

const createMealWithItemsMock = vi.fn()
const deleteMealTemplateMock = vi.fn()
const invalidateDailyLogMock = vi.fn()
const invalidateProductsMock = vi.fn()
const invalidateTemplatesMock = vi.fn()
const lookupBarcodeMock = vi.fn()

vi.mock('@/app/providers/auth', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, session: null, loading: false }),
}))

vi.mock('@/lib/kassalapp', () => ({
  lookupBarcode: (...args: unknown[]) => lookupBarcodeMock(...args),
}))

vi.mock('../meal-sheet/BarcodeScannerView', () => ({
  default: ({
    active,
    onEan,
    barcodeLoading,
    barcodeError,
  }: {
    active: boolean
    onEan: (ean: string) => void
    barcodeLoading: boolean
    barcodeError: string | null
  }) => active ? (
    <div>
      <button type="button" onClick={() => onEan('7038011234567')}>Scan EAN 1</button>
      <button type="button" onClick={() => onEan('7038017654321')}>Scan EAN 2</button>
      {barcodeLoading && <p>Looking up barcode</p>}
      {barcodeError && <p>{barcodeError}</p>}
    </div>
  ) : null,
}))

vi.mock('../api', () => ({
  createMealWithItems: (...args: unknown[]) => createMealWithItemsMock(...args),
  deleteMealTemplate: (...args: unknown[]) => deleteMealTemplateMock(...args),
}))

vi.mock('../useDailyLog', () => ({
  useInvalidateDailyLog: () => invalidateDailyLogMock,
}))

vi.mock('../queryInvalidation', () => ({
  useInvalidateFoodSourceLists: () => invalidateProductsMock,
  useInvalidateUserFoodLibrary: () => invalidateProductsMock,
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
    lookupBarcodeMock.mockResolvedValue(null)
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
    fireEvent.click(await screen.findByRole('button', { name: /Add to Breakfast · 1 item/ }))

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

  it('changes meal type from the sheet title menu', async () => {
    render(
      <MealSheet
        logDate="2026-01-05"
        loggedAt="2026-01-05T08:00:00.000Z"
        onClose={vi.fn()}
        onAdded={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Change meal type, currently Breakfast' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Lunch' }))
    fireEvent.click(screen.getByRole('button', { name: 'My oats' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add to Lunch' }))
    fireEvent.click(await screen.findByRole('button', { name: /Add to Lunch · 1 item/ }))

    await waitFor(() => {
      expect(createMealWithItemsMock).toHaveBeenCalledWith(
        '2026-01-05',
        '2026-01-05T08:00:00.000Z',
        [{ product_id: 'product-1', quantity: 1 }],
        'Lunch',
      )
    })
  })

  it('reopens the serving step from a pending list row', async () => {
    render(
      <MealSheet
        logDate="2026-01-05"
        loggedAt="2026-01-05T08:00:00.000Z"
        onClose={vi.fn()}
        onAdded={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'My oats' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add to Breakfast' }))
    fireEvent.click(await screen.findByRole('tab', { name: 'Pending · 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'My oats' }))

    expect(screen.getByText('220')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Update' })).toBeInTheDocument()
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
    fireEvent.click(await screen.findByRole('button', { name: /Add to Breakfast · 1 item/ }))

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

  it('opens the product form with scanner prefill and blank kcal when nutrition is missing', async () => {
    lookupBarcodeMock.mockResolvedValue({
      ean: '7038011234567',
      name: 'Scanned yogurt',
      brand: 'Brand',
      imageUrl: null,
      caloriesPer100g: null,
      proteinPer100g: 4,
      carbsPer100g: 12,
      fatPer100g: 1.5,
      labelPortionGrams: 150,
    })

    render(
      <MealSheet
        logDate="2026-01-05"
        loggedAt="2026-01-05T08:00:00.000Z"
        onClose={vi.fn()}
        onAdded={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Scan barcode' }))
    fireEvent.click(screen.getByRole('button', { name: 'Scan EAN 1' }))

    await waitFor(() => {
      expect(document.getElementById('name')).toHaveValue('Brand – Scanned yogurt')
      expect(document.getElementById('caloriesPer100g')).toHaveValue(null)
    })
  })

  it('shows scanner error when no barcode product is found', async () => {
    lookupBarcodeMock.mockResolvedValue(null)

    render(
      <MealSheet
        logDate="2026-01-05"
        loggedAt="2026-01-05T08:00:00.000Z"
        onClose={vi.fn()}
        onAdded={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Scan barcode' }))
    fireEvent.click(screen.getByRole('button', { name: 'Scan EAN 1' }))

    expect(await screen.findByText('No product found for this barcode')).toBeInTheDocument()
  })

  it('does not let stale barcode lookup responses overwrite the latest scan', async () => {
    let resolveFirst: (value: null) => void = () => {}
    let resolveSecond: (value: unknown) => void = () => {}
    lookupBarcodeMock
      .mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve }))
      .mockReturnValueOnce(new Promise((resolve) => { resolveSecond = resolve }))

    render(
      <MealSheet
        logDate="2026-01-05"
        loggedAt="2026-01-05T08:00:00.000Z"
        onClose={vi.fn()}
        onAdded={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Scan barcode' }))
    fireEvent.click(screen.getByRole('button', { name: 'Scan EAN 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Scan EAN 2' }))

    resolveSecond({
      ean: '7038017654321',
      name: 'Fresh product',
      brand: 'New',
      imageUrl: null,
      caloriesPer100g: 120,
      proteinPer100g: null,
      carbsPer100g: null,
      fatPer100g: null,
      labelPortionGrams: null,
    })

    await waitFor(() => {
      expect(document.getElementById('name')).toHaveValue('New – Fresh product')
      expect(document.getElementById('caloriesPer100g')).toHaveValue(120)
    })

    resolveFirst(null)

    await waitFor(() => {
      expect(screen.queryByText('No product found for this barcode')).not.toBeInTheDocument()
      expect(document.getElementById('name')).toHaveValue('New – Fresh product')
    })
  })
})
