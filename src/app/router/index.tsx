import { createBrowserRouter, createHashRouter, Navigate } from 'react-router-dom'

import DailyLogPage from '@/pages/app/DailyLogPage'
import AppShell from '@/components/AppShell'
import { AppIndexRedirect, RequireAuth, RequireOnboarding } from '@/app/router/guards'
import RootLayout from '@/app/router/RootLayout'
import RouterLoadingFallback from '@/app/router/RouterLoadingFallback'
import { getRouterBasename, getRouterMode } from '@/lib/appUrl'

const routes = [
  {
    Component: RootLayout,
    HydrateFallback: RouterLoadingFallback,
    children: [
      // Public auth routes
      { path: '/login', lazy: () => import('@/app/router/route-modules/login') },
      { path: '/signup', lazy: () => import('@/app/router/route-modules/signup') },
      { path: '/signup/pending', lazy: () => import('@/app/router/route-modules/signup-pending') },
      { path: '/reset-password', lazy: () => import('@/app/router/route-modules/reset-password') },

      // Onboarding (authenticated but not yet onboarded)
      {
        element: <RequireAuth />,
        children: [
          { path: '/onboarding', lazy: () => import('@/app/router/route-modules/onboarding') },
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
                  { path: '/app/creature', lazy: () => import('@/app/router/route-modules/creature') },
                  { path: '/app/weight', lazy: () => import('@/app/router/route-modules/weight') },
                  { path: '/app/profile', lazy: () => import('@/app/router/route-modules/profile') },
                ],
              },
              // Battle screen: full-screen, no bottom nav
              { path: '/app/creature/battle/:battleRunId', lazy: () => import('@/app/router/route-modules/battle') },
            ],
          },
        ],
      },

      // Catch-all redirect
      { path: '/', element: <Navigate to="/app" replace /> },
      { path: '*', element: <Navigate to="/app" replace /> },
    ],
  },
]

const routerOptions = { basename: getRouterBasename() }

export const router = getRouterMode() === 'hash'
  ? createHashRouter(routes, routerOptions)
  : createBrowserRouter(routes, routerOptions)
