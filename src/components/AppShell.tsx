import { Outlet, NavLink } from 'react-router-dom'

export default function AppShell() {
  const navItems = [
    {
      label: 'Log',
      href: '/app',
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
        <div className="flex max-w-lg mx-auto">
          <NavItem item={navItems[0]} />
          <NavItem item={navItems[1]} />
          <NavItem item={navItems[2]} />
          <NavItem item={navItems[3]} />
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
}

function NavItem({ item }: NavItemProps) {
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
          borderTop: active ? '2px solid var(--app-brand)' : '2px solid transparent',
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
