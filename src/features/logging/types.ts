import type { FoodSource } from '@/types/domain'

export interface Item {
  productId?: string
  catalogItemId?: string
  mealItemId?: string
  foodSource?: FoodSource
  snapshotName?: string
  snapshotCalories?: number
  snapshotServingAmount?: number | null
  snapshotServingUnit?: string | null
  snapshotProteinG?: number | null
  snapshotCarbsG?: number | null
  snapshotFatG?: number | null
  quantity: number
  compositeQuantityMode?: 'grams' | 'pieces'
}
