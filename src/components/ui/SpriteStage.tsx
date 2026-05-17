import { forwardRef, useImperativeHandle, useRef } from 'react'
import type { ResolvedIdleConfig } from '@/lib/spriteIdleConfig'

export interface SpriteStageHandle {
  triggerShake(): void
}

interface SpriteStageProps {
  displaySize: number
  /** Renders a soft radial-gradient ellipse at the base of the stage.
   *  Stays fully opaque independently of any sprite faint/hurt animations. */
  contactShadow?: boolean
  /** Passed from BattlePage so the contact shadow can pulse in sync with the sprite's breath. */
  idleConfig?: ResolvedIdleConfig
  /** Merged onto the root stage div (e.g. z-index in stacked battle columns). */
  className?: string
  children: React.ReactNode
}

const SpriteStage = forwardRef<SpriteStageHandle, SpriteStageProps>(
  function SpriteStage({ displaySize, contactShadow = false, idleConfig, className, children }, ref) {
    const divRef = useRef<HTMLDivElement>(null)

    useImperativeHandle(ref, () => ({
      triggerShake() {
        const el = divRef.current
        if (!el) return
        el.classList.remove('animate-shake')
        void el.offsetWidth
        el.classList.add('animate-shake')
        setTimeout(() => el.classList.remove('animate-shake'), 350)
      },
    }))

    const shadowAnimClass = idleConfig?.breathe
      ? (idleConfig.breathe.distress ? 'animate-shadow-breathe-distress' : 'animate-shadow-breathe')
      : undefined

    return (
      <div
        ref={divRef}
        className={className}
        style={{
          position: 'relative',
          width: displaySize,
          height: displaySize,
          overflow: 'visible',
          ...(idleConfig?.breathe ? {
            '--shadow-breathe-duration': `${idleConfig.breathe.durationS}s`,
            '--shadow-breathe-scale-x': idleConfig.breathe.scaleX,
          } : {}),
        } as React.CSSProperties}
      >
        {contactShadow && (
          <div
            aria-hidden
            className={shadowAnimClass}
            style={{
              position: 'absolute',
              bottom: -1,
              left: '50%',
              // When animation class is active the keyframe owns the full transform (including translateX(-50%)).
              // Without an animation class we need the inline centering.
              ...(!shadowAnimClass ? { transform: 'translateX(-50%)' } : {}),
              width: '85%',
              height: '20%',
              background: 'radial-gradient(ellipse, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0.58) 48%, transparent 74%)',
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
