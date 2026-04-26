import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/app/providers/auth'
import { queryKeys } from '@/lib/queryKeys'
import { fetchProfile } from './api'

interface ProfileSummary {
  timezone: string | null
  calorieTarget: number | null
  onboardingCompletedAt: string | null
}

export function useProfileSummary() {
  const { user } = useAuth()

  return useQuery({
    queryKey: queryKeys.profile.detail(user?.id),
    enabled: !!user,
    queryFn: () => fetchProfile(user!.id),
    select: (data): ProfileSummary => {
      return {
        timezone: data.timezone,
        calorieTarget: data.calorie_target,
        onboardingCompletedAt: data.onboarding_completed_at,
      }
    },
  })
}
