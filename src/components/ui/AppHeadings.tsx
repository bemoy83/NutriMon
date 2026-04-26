import type { ReactNode } from 'react'

type HeadingProps = {
  children: ReactNode
  className?: string
}

type SectionHeaderProps = HeadingProps & {
  as?: 'h2' | 'h3' | 'p'
  headingClassName?: string
  trailing?: ReactNode
  trailingClassName?: string
}

type CardTitleProps = HeadingProps & {
  as?: 'h2' | 'h3' | 'p'
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(' ')
}

export function PageTitle({ children, className }: HeadingProps) {
  return (
    <h1 className={joinClassNames('mb-6 text-xl font-bold text-[var(--app-text-primary)]', className)}>
      {children}
    </h1>
  )
}

export function SectionHeader({
  children,
  className,
  as: Component = 'h2',
  headingClassName,
  trailing,
  trailingClassName,
}: SectionHeaderProps) {
  const textClassName = 'text-xs font-semibold uppercase tracking-[0.08em] text-[var(--app-text-muted)]'

  if (trailing != null) {
    return (
      <div className={joinClassNames('mb-2 flex items-baseline justify-between gap-2 px-1', className)}>
        <Component className={joinClassNames(textClassName, headingClassName)}>
          {children}
        </Component>
        <span className={joinClassNames(textClassName, 'shrink-0 tabular-nums', trailingClassName)}>
          {trailing}
        </span>
      </div>
    )
  }

  return (
    <Component
      className={joinClassNames(
        'mb-2 px-1',
        textClassName,
        className,
      )}
    >
      {children}
    </Component>
  )
}

export function CardTitle({ children, className, as: Component = 'h2' }: CardTitleProps) {
  return (
    <Component className={joinClassNames('text-base font-semibold text-[var(--app-text-primary)]', className)}>
      {children}
    </Component>
  )
}
