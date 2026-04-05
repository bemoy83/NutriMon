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
    <div className="app-page flex min-h-screen items-center justify-center px-4">
      <div className={`w-full max-w-sm ${centered ? 'text-center' : ''}`}>
        <div className="mb-8 text-center">
          <img
            src={creatureMarkUrl}
            alt=""
            className="sprite-pixel-art mx-auto mb-3"
            style={{ width: 56, height: 56, imageRendering: 'pixelated' }}
          />
          <h1 className="text-2xl font-bold text-[var(--app-text-primary)]">{title}</h1>
          <p className="mt-1 text-sm text-[var(--app-text-muted)]">{subtitle}</p>
          {meta ? <div className="mt-2 text-xs text-[var(--app-text-subtle)]">{meta}</div> : null}
        </div>

        {children}

        {footer ? <div className="mt-6 text-center">{footer}</div> : null}
      </div>
    </div>
  )
}
