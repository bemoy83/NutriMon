import { forwardRef, useImperativeHandle, useRef } from 'react'

export interface SpriteStageHandle {
  triggerShake(): void
}

interface SpriteStageProps {
  displaySize: number
  /** Renders a soft radial-gradient ellipse at the base of the stage.
   *  Stays fully opaque independently of any sprite faint/hurt animations. */
  contactShadow?: boolean
  children: React.ReactNode
}

const SpriteStage = forwardRef<SpriteStageHandle, SpriteStageProps>(
  function SpriteStage({ displaySize, contactShadow = false, children }, ref) {
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
        {contactShadow && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              bottom: -4,
              left: '50%',
              transform: 'translateX(-50%)',
              width: '72%',
              height: 16,
              background: 'radial-gradient(ellipse, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.3) 45%, transparent 70%)',
              borderRadius: '50%',
              pointerEvents: 'none',
            }}
          />
        )}
        {children}
      </div>
    )
  },
)

export default SpriteStage
