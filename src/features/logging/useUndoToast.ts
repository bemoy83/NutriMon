import { useEffect, useRef, useState } from 'react'
import { UNDO_TOAST_DURATION } from '@/lib/constants'

export interface UndoAction {
  label: string
  undo: () => Promise<void>
}

export function useUndoToast() {
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearUndo() {
    if (undoTimer.current) clearTimeout(undoTimer.current)
    setUndoAction(null)
  }

  function showUndo(action: UndoAction) {
    if (undoTimer.current) clearTimeout(undoTimer.current)
    setUndoAction(action)
    undoTimer.current = setTimeout(() => setUndoAction(null), UNDO_TOAST_DURATION)
  }

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current)
    }
  }, [])

  return {
    undoAction,
    showUndo,
    clearUndo,
  }
}
