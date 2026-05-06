import { createContext, useContext, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/app/providers/auth'
import { fetchProfile } from '@/features/profile/api'
import { queryKeys } from '@/lib/queryKeys'

interface DevModeContextValue {
  isDevMode: boolean
}

const DevModeContext = createContext<DevModeContextValue>({ isDevMode: false })

export function DevModeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()

  const { data: isDevMode = false } = useQuery({
    queryKey: queryKeys.profile.detail(user?.id),
    enabled: !!user,
    queryFn: () => fetchProfile(user!.id),
    select: (row) => row.is_dev_account ?? false,
  })

  return <DevModeContext.Provider value={{ isDevMode }}>{children}</DevModeContext.Provider>
}

export function useDevMode() {
  return useContext(DevModeContext)
}
