import { createContext, useContext } from 'react'

export interface DevModeContextValue {
  isDevMode: boolean
}

export const DevModeContext = createContext<DevModeContextValue>({ isDevMode: false })

export function useDevMode() {
  return useContext(DevModeContext)
}
