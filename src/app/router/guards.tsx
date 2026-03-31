import { Navigate, Outlet } from 'react-router-dom'
import { getTodayInTimezone, guessTimezone } from '@/lib/date'
import { useAuth } from '@/app/providers/auth'
import { useProfileSummary } from '@/features/profile/useProfileSummary'

export function AppIndexRedirect() {
  const profileQuery = useProfileSummary()

  if (profileQuery.isLoading) return null
  const timezone = profileQuery.data?.timezone ?? guessTimezone()
  const today = getTodayInTimezone(timezone)
  return <Navigate to={`/app/log/${today}`} replace />
}

export function RequireAuth() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}

export function RequireOnboarding() {
  const { user, loading } = useAuth()
  const profileQuery = useProfileSummary()

  if (loading || profileQuery.isLoading) return null
  if (!user) return null
  if (!profileQuery.data?.onboardingCompletedAt) return <Navigate to="/onboarding" replace />
  return <Outlet />
}
