import { forwardRef, useImperativeHandle, useRef } from 'react'

export interface SpriteStageHandle {
  triggerShake(): void
}

interface SpriteStageProps {
  displaySize: number
  children: React.ReactNode
}

const SpriteStage = forwardRef<SpriteStageHandle, SpriteStageProps>(
  function SpriteStage({ displaySize, children }, ref) {
    const divRef = useRef<HTMLDivElement>(null)

    useImperativeHandle(ref, () => ({
      triggerShake() {
        const el = divRef.current
        if (!el) return
        el.classList.remove('animate-shake')
        // Force reflow so re-adding the class restarts the animation
        void el.offsetWidth
        el.classList.add('animate-shake')
        setTimeout(() => el.classList.remove('animate-shake'), 350)
      },
    }))

    return (
      <div
        ref={divRef}
        style={{
          position: 'relative',
          width: displaySize,
          height: displaySize,
          overflow: 'visible',
        }}
      >
        {children}
      </div>
    )
  },
)

export default SpriteStage
