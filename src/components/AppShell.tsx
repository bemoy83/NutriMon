import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/app/providers/auth'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { getTodayInTimezone, guessTimezone } from '@/lib/date'

function useTimezone() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['profile-tz', user?.id],
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('timezone')
        .eq('user_id', user!.id)
        .single()
      return data?.timezone ?? guessTimezone()
    },
  })
}

export default function AppShell() {
  const tzQuery = useTimezone()
  const navigate = useNavigate()
  const timezone = tzQuery.data ?? guessTimezone()
  const today = getTodayInTimezone(timezone)

  const navItems = [
    {
      label: 'Log',
      href: `/app/log/${today}`,
      matchPrefix: '/app/log/',
      icon: (active: boolean) => (
        <svg
          className={`w-6 h-6 ${active ? 'text-indigo-400' : 'text-slate-500'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={active ? 2 : 1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
      ),
    },
    {
      label: 'Creature',
      href: '/app/creature',
      matchPrefix: '/app/creature',
      icon: (active: boolean) => (
        <svg
          className={`w-6 h-6 ${active ? 'text-indigo-400' : 'text-slate-500'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={active ? 2 : 1.5}
            d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    {
      label: 'Weight',
      href: '/app/weight',
      matchPrefix: '/app/weight',
      icon: (active: boolean) => (
        <svg
          className={`w-6 h-6 ${active ? 'text-indigo-400' : 'text-slate-500'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={active ? 2 : 1.5}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      ),
    },
    {
      label: 'Profile',
      href: '/app/profile',
      matchPrefix: '/app/profile',
      icon: (active: boolean) => (
        <svg
          className={`w-6 h-6 ${active ? 'text-indigo-400' : 'text-slate-500'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={active ? 2 : 1.5}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      ),
    },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-slate-950">
      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur border-t border-slate-800 z-20">
        <div className="flex max-w-lg mx-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) => {
                // Also match by prefix for log route
                const active =
                  isActive ||
                  !!(item.matchPrefix &&
                    window.location.pathname.startsWith(item.matchPrefix))
                return `flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-colors ${
                  active ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
                }`
              }}
              onClick={(e) => {
                // For log tab, always go to today
                if (item.href.startsWith('/app/log/')) {
                  e.preventDefault()
                  navigate(item.href)
                }
              }}
            >
              {({ isActive }) => {
                const active =
                  isActive ||
                  !!(item.matchPrefix &&
                    window.location.pathname.startsWith(item.matchPrefix))
                return (
                  <>
                    {item.icon(active)}
                    <span className="text-xs">{item.label}</span>
                  </>
                )
              }}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
