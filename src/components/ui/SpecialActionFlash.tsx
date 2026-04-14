import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { BATTLE_ANIM } from '@/lib/battleAnimationConfig'

export interface SpecialActionFlashHandle {
  /** Trigger a full-viewport flash. `color` defaults to white. */
  triggerFlash(color?: string): void
}

interface FlashState {
  /** Incremented each trigger to force a CSS animation restart via React key. */
  id: number
  color: string
}

const SpecialActionFlash = forwardRef<SpecialActionFlashHandle>(
  function SpecialActionFlash(_props, ref) {
    const [flash, setFlash] = useState<FlashState | null>(null)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useImperativeHandle(ref, () => ({
      triggerFlash(color = 'white') {
        if (timerRef.current) clearTimeout(timerRef.current)
        setFlash((prev) => ({ id: (prev?.id ?? 0) + 1, color }))
        timerRef.current = setTimeout(() => setFlash(null), BATTLE_ANIM.SPECIAL_FLASH_MS)
      },
    }))

    useEffect(() => {
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current)
      }
    }, [])

    if (!flash) return null

    return (
      <div
        key={flash.id}
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          background: flash.color,
          animation: `special-flash ${BATTLE_ANIM.SPECIAL_FLASH_MS}ms ease-out forwards`,
          pointerEvents: 'none',
          zIndex: 9999,
        }}
      />
    )
  },
)

export default SpecialActionFlash
