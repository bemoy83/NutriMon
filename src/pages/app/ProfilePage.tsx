import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ProfileRow } from '@/types/database'
import { useAuth } from '@/app/providers/auth'
import { useNavigate, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { CALORIE_TARGET_MIN, CALORIE_TARGET_MAX } from '@/lib/constants'
import { queryKeys } from '@/lib/queryKeys'
import { PROFILE_FULL_SELECT } from '@/lib/supabaseSelect'
import LoadingState from '@/components/ui/LoadingState'
import { PageTitle, SectionHeader } from '@/components/ui/AppHeadings'

const schema = z.object({
  calorieTarget: z
    .number({ error: 'Enter a calorie target' })
    .int()
    .min(CALORIE_TARGET_MIN)
    .max(CALORIE_TARGET_MAX),
  timezone: z.string().min(1, 'Timezone required'),
})

type FormData = z.infer<typeof schema>

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: 'Sedentary',
  lightly_active: 'Lightly active',
  moderately_active: 'Moderately active',
  very_active: 'Very active',
}

export default function ProfilePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const profileQuery = useQuery({
    queryKey: queryKeys.profile.full(user?.id),
    enabled: !!user,
    queryFn: async (): Promise<ProfileRow> => {
      const { data, error } = await supabase
        .from('profiles')
        .select(PROFILE_FULL_SELECT)
        .eq('user_id', user!.id)
        .single()
      if (error) throw error
      return data as unknown as ProfileRow
    },
  })

  const profile = profileQuery.data

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (profile) {
      reset({
        calorieTarget: profile.calorie_target ?? 2000,
        timezone: profile.timezone ?? '',
      })
    }
  }, [profile, reset])

  async function onSubmit(data: FormData) {
    if (!user) return
    setServerError(null)
    setSaveSuccess(false)

    const { error } = await supabase
      .from('profiles')
      .update({
        calorie_target: data.calorieTarget,
        timezone: data.timezone,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    if (error) {
      setServerError(error.message)
      return
    }

    qc.invalidateQueries({ queryKey: queryKeys.profile.summary(user.id) })
    qc.invalidateQueries({ queryKey: queryKeys.profile.full(user.id) })
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 3000)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  if (profileQuery.isLoading) {
    return <LoadingState fullScreen />
  }

  return (
    <div className="app-page min-h-full px-4 py-6 pb-24">
      <PageTitle>Profile</PageTitle>

      {/* Read-only profile info */}
      <SectionHeader>Your stats</SectionHeader>
      <div className="app-card mb-5 space-y-3 p-4">
        <ProfileRow label="Email" value={user?.email ?? '—'} />
        <ProfileRow label="Height" value={profile?.height_cm ? `${profile.height_cm} cm` : '—'} />
        <ProfileRow label="Starting weight" value={profile?.starting_weight_kg ? `${profile.starting_weight_kg} kg` : '—'} />
        <ProfileRow label="Age" value={profile?.age_years ? `${profile.age_years}` : '—'} />
        <ProfileRow
          label="Activity level"
          value={profile?.activity_level ? ACTIVITY_LABELS[profile.activity_level] ?? profile.activity_level : '—'}
        />
      </div>

      {/* Editable settings */}
      <SectionHeader>Settings</SectionHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="app-card mb-5 space-y-4 p-4">
        <div>
          <label htmlFor="calorieTarget" className="mb-1 block text-sm text-[var(--app-text-secondary)]">
            Daily calorie target
          </label>
          <input
            id="calorieTarget"
            type="number"
            {...register('calorieTarget', { valueAsNumber: true })}
            className="app-input px-3 py-2"
          />
          {errors.calorieTarget && (
            <p className="text-[var(--app-danger)] text-xs mt-1">{errors.calorieTarget.message}</p>
          )}
          <p className="text-[var(--app-text-muted)] text-xs mt-1">
            Range: {CALORIE_TARGET_MIN}–{CALORIE_TARGET_MAX}
          </p>
        </div>

        <div>
          <label htmlFor="timezone" className="mb-1 block text-sm text-[var(--app-text-secondary)]">
            Timezone
          </label>
          <input
            id="timezone"
            type="text"
            {...register('timezone')}
            className="app-input px-3 py-2"
            placeholder="America/New_York"
          />
          {errors.timezone && (
            <p className="text-[var(--app-danger)] text-xs mt-1">{errors.timezone.message}</p>
          )}
        </div>

        {serverError && <p className="text-[var(--app-danger)] text-sm">{serverError}</p>}
        {saveSuccess && <p className="text-[var(--app-success)] text-sm">Saved.</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="app-button-primary w-full py-2.5"
        >
          {isSubmitting ? 'Saving…' : 'Save changes'}
        </button>
      </form>

      <SectionHeader>Weight</SectionHeader>
      <Link
        to="/app/weight"
        className="app-card mb-4 flex items-center justify-between p-4 transition-colors hover:bg-[var(--app-hover-overlay)]"
      >
        <div>
          <p className="text-sm font-medium text-[var(--app-text-primary)]">Log weight</p>
          <p className="text-[var(--app-text-muted)] text-xs mt-1">Entries and trends over time.</p>
        </div>
        <svg
          className="h-5 w-5 flex-none text-[var(--app-text-muted)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </Link>

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        className="app-button-danger w-full rounded-xl py-2.5"
      >
        Sign out
      </button>
    </div>
  )
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--app-text-muted)] text-sm">{label}</span>
      <span className="text-[var(--app-text-primary)] text-sm">{value}</span>
    </div>
  )
}
