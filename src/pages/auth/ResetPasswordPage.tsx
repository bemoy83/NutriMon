import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useState } from 'react'
import { getExternalAppUrl } from '@/lib/appUrl'
import AuthShell from '@/components/auth/AuthShell'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
})

type FormData = z.infer<typeof schema>

export default function ResetPasswordPage() {
  const [sent, setSent] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setServerError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: getExternalAppUrl('/login'),
    })
    if (error) {
      setServerError(error.message)
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <AuthShell
        title="Check your email"
        subtitle="We sent a password reset link. It expires in 1 hour."
        centered
        footer={
          <Link to="/login" className="app-link text-sm hover:underline">
            Back to sign in
          </Link>
        }
      >
        <div />
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Reset password"
      subtitle="Enter your email and we'll send a reset link"
      footer={
        <Link to="/login" className="text-sm text-[var(--app-text-subtle)] hover:underline">
          Back to sign in
        </Link>
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

          {serverError && (
            <p className="text-red-400 text-sm text-center">{serverError}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="app-button-primary w-full py-2.5"
          >
            {isSubmitting ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
    </AuthShell>
  )
}
