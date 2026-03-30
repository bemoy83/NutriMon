import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { getTodayInTimezone, guessTimezone } from '@/lib/date'
import { useTimezone } from '@/features/profile/useTimezone'

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
          className="w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={active ? 2 : 1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
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
          className="w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={active ? 2 : 1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
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
          className="w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={active ? 2 : 1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
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
          className="w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={active ? 2 : 1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      ),
    },
  ]

  const trendsFabActive =
    typeof window !== 'undefined' &&
    window.location.pathname.startsWith('/app/trends')

  return (
    <div className="app-page flex min-h-screen flex-col">
      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      {/* Bottom navigation */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t backdrop-blur"
        style={{
          borderColor: 'var(--app-border)',
          background: 'var(--app-nav-bg)',
        }}
      >
        <div className="flex max-w-lg mx-auto items-end">
          {/* Log */}
          <NavItem item={navItems[0]} onNavigate={navigate} />

          {/* Creature */}
          <NavItem item={navItems[1]} onNavigate={navigate} />

          {/* Center FAB — Trends */}
          <div className="flex-1 flex flex-col items-center pb-2">
            <NavLink
              to="/app/trends"
              aria-label="Trends"
              className="flex flex-col items-center gap-0.5"
              style={trendsFabActive ? { color: 'var(--app-brand)' } : { color: 'var(--app-text-muted)' }}
            >
              {() => (
                <>
                  <span
                    className="w-12 h-12 rounded-full flex items-center justify-center shadow-md -mt-5 transition-colors"
                    style={{
                      background: trendsFabActive
                        ? 'var(--app-brand-hover)'
                        : 'var(--app-brand)',
                    }}
                  >
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="white"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                      />
                    </svg>
                  </span>
                  <span className="text-xs">Trends</span>
                </>
              )}
            </NavLink>
          </div>

          {/* Weight */}
          <NavItem item={navItems[2]} onNavigate={navigate} />

          {/* Profile */}
          <NavItem item={navItems[3]} onNavigate={navigate} />
        </div>
      </nav>
    </div>
  )
}

type NavItemProps = {
  item: {
    label: string
    href: string
    matchPrefix: string
    icon: (active: boolean) => React.ReactNode
  }
  onNavigate: (href: string) => void
}

function NavItem({ item, onNavigate }: NavItemProps) {
  return (
    <NavLink
      to={item.href}
      className="flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-colors"
      style={({ isActive }) => {
        const active =
          isActive ||
          (typeof window !== 'undefined' &&
            window.location.pathname.startsWith(item.matchPrefix))
        return {
          color: active ? 'var(--app-brand)' : 'var(--app-text-muted)',
        }
      }}
      onClick={(e) => {
        if (item.href.startsWith('/app/log/')) {
          e.preventDefault()
          onNavigate(item.href)
        }
      }}
    >
      {({ isActive }) => {
        const active =
          isActive ||
          (typeof window !== 'undefined' &&
            window.location.pathname.startsWith(item.matchPrefix))
        return (
          <>
            {item.icon(active)}
            <span className="text-xs">{item.label}</span>
          </>
        )
      }}
    </NavLink>
  )
}
