import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useState } from 'react'
import AuthShell from '@/components/auth/AuthShell'

const schema = z
  .object({
    email: z.string().email('Enter a valid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type FormData = z.infer<typeof schema>

export default function SignupPage() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setServerError(null)
    const { data: signUpData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
    })
    if (error) {
      setServerError(error.message)
      return
    }

    if (signUpData.session) {
      navigate('/onboarding')
      return
    }

    navigate('/signup/pending', { state: { email: data.email } })
  }

  return (
    <AuthShell
      title="NutriMon"
      subtitle="Create your account"
      meta="Email confirmation is required before public access."
      footer={
        <p className="text-sm text-[var(--app-text-muted)]">
          Already have an account?{' '}
          <Link to="/login" className="app-link hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm text-[var(--app-text-secondary)]">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              {...register('email')}
              className="app-input px-3 py-2"
              placeholder="you@example.com"
            />
            {errors.email && (
              <p className="text-[var(--app-danger)] text-xs mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm text-[var(--app-text-secondary)]">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              {...register('password')}
              className="app-input px-3 py-2"
              placeholder="••••••••"
            />
            {errors.password && (
              <p className="text-[var(--app-danger)] text-xs mt-1">{errors.password.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="mb-1 block text-sm text-[var(--app-text-secondary)]">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              {...register('confirmPassword')}
              className="app-input px-3 py-2"
              placeholder="••••••••"
            />
            {errors.confirmPassword && (
              <p className="text-[var(--app-danger)] text-xs mt-1">{errors.confirmPassword.message}</p>
            )}
          </div>

          {serverError && (
            <p className="text-[var(--app-danger)] text-sm text-center">{serverError}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="app-button-primary w-full py-2.5"
          >
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>
    </AuthShell>
  )
}
