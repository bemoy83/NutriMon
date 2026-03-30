interface LoadingStateProps {
  label?: string
  fullScreen?: boolean
}

export default function LoadingState({ label = 'Loading…', fullScreen = false }: LoadingStateProps) {
  return (
    <div
      className={`flex items-center justify-center ${fullScreen ? 'min-h-screen' : 'py-12'} app-page`}
    >
      <div className="text-sm text-[var(--app-text-muted)]">{label}</div>
    </div>
  )
}
