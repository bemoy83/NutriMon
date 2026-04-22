import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  FREQUENT_PRODUCTS_LIMIT,
  RECENT_PRODUCTS_LIMIT,
  SEARCH_PRODUCTS_LIMIT,
} from '@/lib/constants'
import { useAuth } from '@/app/providers/auth'
import { mapFoodSource, mapProduct } from '@/lib/domainMappers'
import type { FoodSource } from '@/types/domain'
import type { FoodCatalogItemRow, ProductRow } from '@/types/database'

function mapCatalogItemToFoodSource(row: FoodCatalogItemRow): FoodSource {
  return {
    sourceType: 'catalog_item',
    sourceId: row.id,
    name: row.name,
    calories: row.calories,
    caloriesPer100g: row.calories,
    proteinG: row.protein_g,
    carbsG: row.carbs_g,
    fatG: row.fat_g,
    defaultServingAmount: row.default_serving_amount,
    defaultServingUnit: row.default_serving_unit,
    labelPortionGrams: null,
    useCount: 0,
    lastUsedAt: null,
    kind: 'simple',
    pieceCount: null,
    pieceLabel: null,
    totalMassG: null,
  }
}

function mapProductToFoodSource(row: ProductRow): FoodSource {
  const product = mapProduct(row)
  return {
    sourceType: 'user_product',
    sourceId: product.id,
    name: product.name,
    calories: product.calories,
    caloriesPer100g: product.caloriesPer100g ?? product.calories,
    proteinG: product.proteinPer100g ?? product.proteinG,
    carbsG: product.carbsPer100g ?? product.carbsG,
    fatG: product.fatPer100g ?? product.fatG,
    defaultServingAmount: product.defaultServingAmount,
    defaultServingUnit: product.defaultServingUnit,
    labelPortionGrams: product.labelPortionGrams,
    useCount: product.useCount,
    lastUsedAt: product.lastUsedAt,
    kind: product.kind,
    pieceCount: product.pieceCount,
    pieceLabel: product.pieceLabel,
    totalMassG: product.totalMassG,
  }
}

export function useRecentFoodSources() {
  const { user } = useAuth()
  return useQuery<FoodSource[]>({
    queryKey: ['food-sources', 'recent', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_recent_food_sources', {
        p_limit: RECENT_PRODUCTS_LIMIT,
      })
      if (error) throw error
      return (data ?? []).map(mapFoodSource)
    },
  })
}

export function useFrequentFoodSources() {
  const { user } = useAuth()
  return useQuery<FoodSource[]>({
    queryKey: ['food-sources', 'frequent', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_frequent_food_sources', {
        p_limit: FREQUENT_PRODUCTS_LIMIT,
      })
      if (error) throw error
      return (data ?? []).map(mapFoodSource)
    },
  })
}

export function useFoodSourceSearch(query: string) {
  const { user } = useAuth()
  return useQuery<FoodSource[]>({
    queryKey: ['food-sources', 'search', user?.id, query],
    enabled: !!user && query.trim().length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_food_sources', {
        p_query: query.trim(),
        p_limit: SEARCH_PRODUCTS_LIMIT,
      })
      if (error) throw error
      return (data ?? []).map(mapFoodSource)
    },
  })
}

export function useFoodSourceMap(productIds: string[], catalogItemIds: string[]) {
  const { user } = useAuth()
  const normalizedProductIds = [...new Set(productIds)].sort()
  const normalizedCatalogIds = [...new Set(catalogItemIds)].sort()

  return useQuery<Record<string, FoodSource>>({
    queryKey: ['food-sources', 'map', user?.id, normalizedProductIds, normalizedCatalogIds],
    enabled: !!user && (normalizedProductIds.length > 0 || normalizedCatalogIds.length > 0),
    queryFn: async () => {
      const [productResult, catalogResult] = await Promise.all([
        normalizedProductIds.length > 0
          ? supabase
              .from('products')
              .select('*')
              .in('id', normalizedProductIds)
          : Promise.resolve({ data: [] as ProductRow[], error: null }),
        normalizedCatalogIds.length > 0
          ? supabase
              .from('food_catalog_items')
              .select('*')
              .in('id', normalizedCatalogIds)
          : Promise.resolve({ data: [] as FoodCatalogItemRow[], error: null }),
      ])

      if (productResult.error) throw productResult.error
      if (catalogResult.error) throw catalogResult.error

      const entries: Array<[string, FoodSource]> = [
        ...((productResult.data ?? []) as ProductRow[]).map(
          (row): [string, FoodSource] => [`user_product:${row.id}`, mapProductToFoodSource(row)],
        ),
        ...((catalogResult.data ?? []) as FoodCatalogItemRow[]).map(
          (row): [string, FoodSource] => [`catalog_item:${row.id}`, mapCatalogItemToFoodSource(row)],
        ),
      ]

      return Object.fromEntries(entries)
    },
  })
}
