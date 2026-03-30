import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  description?: ReactNode
  className?: string
}

export default function EmptyState({ title, description, className = '' }: EmptyStateProps) {
  return (
    <div className={`app-empty-state py-10 ${className}`.trim()}>
      <p className="text-sm text-[var(--app-text-muted)]">{title}</p>
      {description ? <p className="mt-1 text-xs text-[var(--app-text-subtle)]">{description}</p> : null}
    </div>
  )
}
