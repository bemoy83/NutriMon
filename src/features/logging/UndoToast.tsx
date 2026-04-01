import type { UndoAction } from './useUndoToast'

interface UndoToastProps {
  action: UndoAction
  onUndo: () => Promise<void>
}

export default function UndoToast({ action, onUndo }: UndoToastProps) {
  return (
    <div className="fixed bottom-32 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2">
      <div
        className="flex items-center justify-between gap-3 rounded-full px-4 py-3 text-sm text-white shadow-lg"
        style={{ background: 'var(--app-toast-bg)' }}
      >
        <span>{action.label}</span>
        <button
          type="button"
          onClick={onUndo}
          className="font-medium transition-colors"
          style={{ color: 'var(--app-brand-soft)' }}
        >
          Undo
        </button>
      </div>
    </div>
  )
}
