import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProductForm from '../ProductForm'
import type { Product } from '@/types/domain'

const useAuthMock = vi.fn()
const updateMock = vi.fn()
const selectMock = vi.fn()
const singleMock = vi.fn()

vi.mock('@/app/providers/auth', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: updateMock,
    })),
  },
}))

const initialProduct: Product = {
  id: 'product-1',
  userId: 'user-1',
  name: 'Chicken Breast',
  calories: 165,
  proteinG: 31,
  carbsG: 0,
  fatG: 3.6,
  labelPortionGrams: null,
  defaultServingAmount: 100,
  defaultServingUnit: 'g',
  useCount: 4,
  lastUsedAt: '2026-01-05T08:30:00.000Z',
  kind: 'simple',
  totalMassG: null,
  caloriesPer100g: 165,
  proteinPer100g: 31,
  carbsPer100g: 0,
  fatPer100g: 3.6,
  pieceCount: null,
  pieceLabel: null,
  createdAt: '2026-01-01T08:30:00.000Z',
  updatedAt: '2026-01-05T08:30:00.000Z',
}

describe('ProductForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthMock.mockReturnValue({ user: { id: 'user-1' } })
    singleMock.mockResolvedValue({
      data: {
        id: 'product-1',
        user_id: 'user-1',
        name: 'Chicken Breast',
        calories: 180,
        protein_g: 31,
        carbs_g: 0,
        fat_g: 3.6,
        label_portion_grams: null,
        default_serving_amount: 100,
        default_serving_unit: 'g',
        use_count: 4,
        last_used_at: '2026-01-05T08:30:00.000Z',
        kind: 'simple',
        total_mass_g: null,
        calories_per_100g: 180,
        protein_per_100g: 31,
        carbs_per_100g: 0,
        fat_per_100g: 3.6,
        piece_count: null,
        piece_label: null,
        created_at: '2026-01-01T08:30:00.000Z',
        updated_at: '2026-01-06T08:30:00.000Z',
      },
      error: null,
    })
    selectMock.mockReturnValue({ single: singleMock })
    updateMock.mockReturnValue({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: selectMock,
        })),
      })),
    })
  })

  it('updates an existing product and returns the mapped domain object', async () => {
    const onSave = vi.fn()

    render(
      <ProductForm
        initialProduct={initialProduct}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    )

    fireEvent.change(document.getElementById('caloriesPer100g')!, { target: { value: '180' } })
    fireEvent.click(screen.getByText('Save changes'))

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Chicken Breast',
          calories: 180,
          calories_per_100g: 180,
          protein_g: 31,
          protein_per_100g: 31,
          carbs_g: 0,
          carbs_per_100g: 0,
          fat_g: 3.6,
          fat_per_100g: 3.6,
          label_portion_grams: null,
          default_serving_amount: 100,
          default_serving_unit: 'g',
        }),
      )
    })

    expect(onSave).toHaveBeenCalledWith({
      id: 'product-1',
      userId: 'user-1',
      name: 'Chicken Breast',
      calories: 180,
      proteinG: 31,
      carbsG: 0,
      fatG: 3.6,
      labelPortionGrams: null,
      defaultServingAmount: 100,
      defaultServingUnit: 'g',
      useCount: 4,
      lastUsedAt: '2026-01-05T08:30:00.000Z',
      kind: 'simple',
      totalMassG: null,
      caloriesPer100g: 180,
      proteinPer100g: 31,
      carbsPer100g: 0,
      fatPer100g: 3.6,
      pieceCount: null,
      pieceLabel: null,
      createdAt: '2026-01-01T08:30:00.000Z',
      updatedAt: '2026-01-06T08:30:00.000Z',
    })
  })
})
