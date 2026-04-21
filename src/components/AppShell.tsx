import { Outlet, NavLink, useLocation } from 'react-router-dom'

export default function AppShell() {
  const navItems = [
    {
      label: 'Log',
      href: '/app',
      /** Without end, NavLink treats every /app/* route as matching /app, so Log stayed selected on all tabs. */
      end: true,
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
            d="M12 2l9 4v6c0 5.25-3.75 10.15-9 11.25C6.75 22.15 3 17.25 3 12V6l9-4z"
          />
        </svg>
      ),
    },
    {
      label: 'Battle',
      href: '/app/battle',
      matchPrefix: '/app/battle',
      icon: (active: boolean) => (
        <svg
          className="w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={active ? 2 : 1.5}
        >
          <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
          <line x1="13" x2="19" y1="19" y2="13" />
          <line x1="16" x2="20" y1="16" y2="20" />
          <line x1="19" x2="21" y1="21" y2="19" />
          <polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5" />
          <line x1="5" x2="9" y1="14" y2="18" />
          <line x1="7" x2="4" y1="17" y2="20" />
          <line x1="3" x2="5" y1="19" y2="21" />
        </svg>
      ),
    },
    {
      label: 'My Food',
      href: '/app/my-food',
      matchPrefix: '/app/my-food',
      icon: (active: boolean) => (
        <svg
          className="w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={active ? 2 : 1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z" />
          <path d="M10 2c1 .5 2 2 2 5" />
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

  return (
    <div className="app-page flex h-dvh flex-col">
      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      {/* Bottom navigation */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 pb-[env(safe-area-inset-bottom,0px)]"
        style={{
          background: 'var(--app-nav-bg)',
          borderTop: '1px solid var(--app-border)',
        }}
      >
        <div className="mx-auto flex max-w-lg">
          {navItems.map((item) => (
            <NavItem key={item.href} item={item} />
          ))}
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
    end?: boolean
    icon: (active: boolean) => React.ReactNode
  }
}

function NavItem({ item }: NavItemProps) {
  const { pathname } = useLocation()
  const prefixActive = pathname.startsWith(item.matchPrefix)

  return (
    <NavLink
      to={item.href}
      end={item.end}
      className="relative flex min-w-0 flex-1 flex-col items-center py-1.5 sm:py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--app-focus)]"
    >
      {({ isActive }) => {
        const active = isActive || prefixActive
        return (
          <>
            {/* Slim top-edge indicator */}
            {active ? (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 flex justify-center"
              >
                <span className="h-[3px] w-8 rounded-b-full bg-[var(--app-brand)]" />
              </span>
            ) : null}

            {/* Icon + label pill */}
            <span
              className={`relative flex w-full min-w-0 max-w-full flex-col items-center gap-0.5 rounded-lg px-1 py-0.5 transition-colors duration-[var(--app-transition-fast)] sm:rounded-xl sm:px-2.5 sm:py-1 md:px-3.5 ${
                active
                  ? 'text-[var(--app-brand)] bg-[rgb(124_58_237/0.10)] shadow-[inset_0_1px_3px_rgb(0_0_0/0.10)]'
                  : 'text-[var(--app-text-muted)] hover:text-[var(--app-text-secondary)] hover:bg-[rgb(0_0_0/0.07)]'
              }`}
            >
              {item.icon(active)}
              <span className="text-center text-[0.6875rem] font-medium leading-tight whitespace-nowrap sm:text-xs">
                {item.label}
              </span>
            </span>
          </>
        )
      }}
    </NavLink>
  )
}
