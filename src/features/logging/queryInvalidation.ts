import { useQueryClient } from '@tanstack/react-query'

export function useInvalidateProductQueries() {
  const queryClient = useQueryClient()

  return () => {
    queryClient.invalidateQueries({ queryKey: ['products'] })
    queryClient.invalidateQueries({ queryKey: ['profile-products'] })
    queryClient.invalidateQueries({ queryKey: ['food-sources'] })
  }
}
