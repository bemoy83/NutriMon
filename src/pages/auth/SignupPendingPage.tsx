import { Link, useLocation } from 'react-router-dom'

interface LocationState {
  email?: string
}

export default function SignupPendingPage() {
  const location = useLocation()
  const state = location.state as LocationState | null

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold text-white">Check your email</h1>
        <p className="mt-3 text-slate-400 text-sm">
          {state?.email
            ? `We sent a confirmation link to ${state.email}. Confirm your email before signing in.`
            : 'We sent a confirmation link to your email address. Confirm your email before signing in.'}
        </p>
        <p className="mt-3 text-slate-500 text-xs">
          Public accounts require email confirmation. If you do not see the message, check spam or retry later if the email provider is rate-limited.
        </p>
        <div className="mt-6 space-y-3">
          <Link
            to="/login"
            className="block w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
          >
            Back to sign in
          </Link>
          <Link
            to="/signup"
            className="inline-block text-indigo-400 text-sm hover:underline"
          >
            Use a different email
          </Link>
        </div>
      </div>
    </div>
  )
}
