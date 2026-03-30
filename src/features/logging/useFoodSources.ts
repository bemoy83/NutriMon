import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  FREQUENT_PRODUCTS_LIMIT,
  RECENT_PRODUCTS_LIMIT,
  SEARCH_PRODUCTS_LIMIT,
} from '@/lib/constants'
import { useAuth } from '@/app/providers/auth'
import { mapFoodSource } from '@/lib/domainMappers'

export function useRecentFoodSources() {
  const { user } = useAuth()
  return useQuery({
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
  return useQuery({
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
  return useQuery({
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
