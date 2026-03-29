import { Navigate, Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getTodayInTimezone, guessTimezone } from '@/lib/date'
import { useAuth } from '@/app/providers/auth'

export function AppIndexRedirect() {
  const { user } = useAuth()
  const [timezone, setTimezone] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('timezone')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        setTimezone(data?.timezone ?? guessTimezone())
      })
  }, [user])

  if (!timezone) return null
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
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null)

  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('onboarding_completed_at')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        setOnboardingDone(!!data?.onboarding_completed_at)
      })
  }, [user])

  if (loading || onboardingDone === null) return null
  if (!onboardingDone) return <Navigate to="/onboarding" replace />
  return <Outlet />
}
