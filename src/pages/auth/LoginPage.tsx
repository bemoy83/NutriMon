import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useState } from 'react'
import AuthShell from '@/components/auth/AuthShell'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setServerError(null)
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })
    if (error) {
      setServerError(error.message)
      return
    }
    navigate('/app')
  }

  return (
    <AuthShell
      title="NutriMon"
      subtitle="Sign in to your account"
      meta="Confirm your email first if you just created an account."
      footer={
        <div className="space-y-2">
          <p className="text-sm text-[var(--app-text-muted)]">
            No account?{' '}
            <Link to="/signup" className="app-link hover:underline">
              Sign up
            </Link>
          </p>
          <p>
            <Link to="/reset-password" className="text-xs text-[var(--app-text-subtle)] hover:underline">
              Forgot password?
            </Link>
          </p>
        </div>
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
              <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm text-[var(--app-text-secondary)]">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register('password')}
              className="app-input px-3 py-2"
              placeholder="••••••••"
            />
            {errors.password && (
              <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>
            )}
          </div>

          {serverError && (
            <p className="text-red-400 text-sm text-center">{serverError}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="app-button-primary w-full py-2.5"
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
    </AuthShell>
  )
}
