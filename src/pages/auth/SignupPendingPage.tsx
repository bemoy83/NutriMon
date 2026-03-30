import { Link, useLocation } from 'react-router-dom'
import AuthShell from '@/components/auth/AuthShell'

interface LocationState {
  email?: string
}

export default function SignupPendingPage() {
  const location = useLocation()
  const state = location.state as LocationState | null

  return (
    <AuthShell
      title="Check your email"
      subtitle={
        state?.email
          ? `We sent a confirmation link to ${state.email}. Confirm your email before signing in.`
          : 'We sent a confirmation link to your email address. Confirm your email before signing in.'
      }
      meta="Public accounts require email confirmation. If you do not see the message, check spam or retry later if the email provider is rate-limited."
      centered
      footer={
        <div className="space-y-3">
          <Link to="/login" className="app-button-primary block w-full py-2.5">
            Back to sign in
          </Link>
          <Link to="/signup" className="app-link inline-block text-sm hover:underline">
            Use a different email
          </Link>
        </div>
      }
    >
      <div />
    </AuthShell>
  )
}
