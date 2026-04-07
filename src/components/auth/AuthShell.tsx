import type { ReactNode } from 'react'

const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')
const creatureMarkUrl = `${base}/sprites/player_battle/baby_steady.png`

interface AuthShellProps {
  title: string
  subtitle: string
  meta?: ReactNode
  children: ReactNode
  footer?: ReactNode
  centered?: boolean
}

export default function AuthShell({
  title,
  subtitle,
  meta,
  children,
  footer,
  centered = false,
}: AuthShellProps) {
  return (
    <div className="app-page flex min-h-screen items-center justify-center px-4 py-8">
      <div className={`w-full max-w-sm ${centered ? 'text-center' : ''}`}>
        <div className="app-card px-6 pb-6 pt-8">
          {/* Mascot + heading */}
          <div className="mb-6 text-center">
            <img
              src={creatureMarkUrl}
              alt=""
              className="sprite-pixel-art mx-auto mb-4"
              style={{ width: 64, height: 64, imageRendering: 'pixelated' }}
            />
            <h1 className="text-2xl font-bold text-[var(--app-text-primary)]">{title}</h1>
            <p className="mt-1 text-sm text-[var(--app-text-muted)]">{subtitle}</p>
            {meta ? <div className="mt-2 text-xs text-[var(--app-text-subtle)]">{meta}</div> : null}
          </div>

          {children}
        </div>

        {footer ? <div className="mt-5 text-center">{footer}</div> : null}
      </div>
    </div>
  )
}
