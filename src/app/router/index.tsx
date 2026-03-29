import { createBrowserRouter, Navigate } from 'react-router-dom'

// Pages (lazy-loaded equivalent via direct imports for now)
import LoginPage from '@/pages/auth/LoginPage'
import SignupPage from '@/pages/auth/SignupPage'
import SignupPendingPage from '@/pages/auth/SignupPendingPage'
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage'
import OnboardingPage from '@/pages/app/OnboardingPage'
import DailyLogPage from '@/pages/app/DailyLogPage'
import CreaturePage from '@/pages/app/CreaturePage'
import WeightPage from '@/pages/app/WeightPage'
import ProfilePage from '@/pages/app/ProfilePage'
import AppShell from '@/components/AppShell'
import { AppIndexRedirect, RequireAuth, RequireOnboarding } from '@/app/router/guards'

export const router = createBrowserRouter([
  // Public auth routes
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignupPage /> },
  { path: '/signup/pending', element: <SignupPendingPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },

  // Onboarding (authenticated but not yet onboarded)
  {
    element: <RequireAuth />,
    children: [
      { path: '/onboarding', element: <OnboardingPage /> },
    ],
  },

  // Protected app routes
  {
    element: <RequireAuth />,
    children: [
      {
        element: <RequireOnboarding />,
        children: [
          {
            element: <AppShell />,
            children: [
              { path: '/app', element: <AppIndexRedirect /> },
              { path: '/app/log/:date', element: <DailyLogPage /> },
              { path: '/app/creature', element: <CreaturePage /> },
              { path: '/app/weight', element: <WeightPage /> },
              { path: '/app/profile', element: <ProfilePage /> },
            ],
          },
        ],
      },
    ],
  },

  // Catch-all redirect
  { path: '/', element: <Navigate to="/app" replace /> },
  { path: '*', element: <Navigate to="/app" replace /> },
])
