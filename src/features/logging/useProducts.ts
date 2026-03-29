import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/providers/auth'
import type { Product } from '@/types/domain'
import type { ProductRow } from '@/types/database'
import {
  RECENT_PRODUCTS_LIMIT,
  FREQUENT_PRODUCTS_LIMIT,
  SEARCH_PRODUCTS_LIMIT,
} from '@/lib/constants'

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    calories: row.calories,
    proteinG: row.protein_g,
    carbsG: row.carbs_g,
    fatG: row.fat_g,
    defaultServingAmount: row.default_serving_amount,
    defaultServingUnit: row.default_serving_unit,
    useCount: row.use_count,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function useRecentProducts() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['products', 'recent', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', user!.id)
        .order('last_used_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(RECENT_PRODUCTS_LIMIT)
      if (error) throw error
      return data.map(toProduct)
    },
  })
}

export function useFrequentProducts() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['products', 'frequent', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', user!.id)
        .order('use_count', { ascending: false })
        .order('last_used_at', { ascending: false, nullsFirst: false })
        .limit(FREQUENT_PRODUCTS_LIMIT)
      if (error) throw error
      return data.map(toProduct)
    },
  })
}

export function useProductSearch(query: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['products', 'search', user?.id, query],
    enabled: !!user && query.trim().length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', user!.id)
        .ilike('name', `%${query.trim()}%`)
        .order('use_count', { ascending: false })
        .limit(SEARCH_PRODUCTS_LIMIT)
      if (error) throw error
      return data.map(toProduct)
    },
  })
}

export function useInvalidateProducts() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['products'] })
    qc.invalidateQueries({ queryKey: ['profile-products'] })
  }
}
