import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react'
import type { AnimationDescriptor, SpriteDescriptor } from '@/lib/sprites'
import { BATTLE_ANIM } from '@/lib/battleAnimationConfig'
import type { ResolvedIdleConfig } from '@/lib/spriteIdleConfig'

export interface CreatureSpriteHandle {
  triggerAnimation(type: 'hurt' | 'faint' | 'attack', durationMs: number, isCrit?: boolean, lungeDir?: 'right' | 'left'): void
  triggerAnticipation(direction: 'right' | 'left', durationMs: number, heavy?: boolean): void
  triggerChargeGlow(): void
  triggerHealGlow(): void
  triggerFocusGlow(): void
}

interface CreatureSpriteProps {
  descriptor: SpriteDescriptor | null
  displaySize: number
  /** true = apply scaleX(-1) to flip the sprite horizontally */
  flip?: boolean
  idleAnimation?: AnimationDescriptor | null
  /** Resolved idle animation profile from resolveIdleConfig(). Drives breathing and sway.
   *  Only applied when a real sprite is loaded and the sprite has not fainted. */
  idleConfig?: ResolvedIdleConfig
  className?: string
}

interface HitFlash {
  id: number
  isCrit: boolean
  durationMs: number
}

// SVG silhouette rendered when no sprite is registered yet
function SpritePlaceholder({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="64" height="64" rx="10" fill="var(--app-surface-muted)" />
      {/* Simple creature blob silhouette */}
      <ellipse cx="32" cy="36" rx="16" ry="14" fill="var(--app-border)" />
      <ellipse cx="32" cy="22" rx="10" ry="10" fill="var(--app-border)" />
      <ellipse cx="24" cy="14" rx="5" ry="7" fill="var(--app-border)" />
      <ellipse cx="40" cy="14" rx="5" ry="7" fill="var(--app-border)" />
    </svg>
  )
}

const CreatureSprite = forwardRef<CreatureSpriteHandle, CreatureSpriteProps>(
  function CreatureSprite({ descriptor, displaySize, flip = false, idleAnimation, idleConfig, className }, ref) {
    const pixelArt = descriptor?.pixelArt ?? false
    const [activeAnimation, setActiveAnimation] = useState<{
      id: number
      type: 'hurt' | 'faint' | 'attack'
      isCrit: boolean
      durationMs: number
      lungeDir?: 'right' | 'left'
    } | null>(null)
    const [hasFainted, setHasFainted] = useState(false)
    const [hitFlashes, setHitFlashes] = useState<HitFlash[]>([])
    const [isCharging, setIsCharging] = useState(false)
    const [isHealing, setIsHealing] = useState(false)
    const [isFocusing, setIsFocusing] = useState(false)
    const healGlowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const focusGlowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [activeAnticipation, setActiveAnticipation] = useState<{
      id: number
      direction: 'right' | 'left'
      durationMs: number
      heavy: boolean
    } | null>(null)
    const chargeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const anticipationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const descriptorKey = descriptor ? `${descriptor.url}:${descriptor.facing}` : 'placeholder'
    const [frameState, setFrameState] = useState({ descriptorKey, currentFrame: 0 })

    useEffect(() => {
      const id = requestAnimationFrame(() => {
        setHasFainted(false)
        setFrameState({ descriptorKey, currentFrame: 0 })
      })
      return () => cancelAnimationFrame(id)
    }, [descriptorKey])
    const animClearRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const hitFlashIdRef = useRef(0)
    const hitFlashTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
    const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const currentFrame = frameState.descriptorKey === descriptorKey ? frameState.currentFrame : 0
    // Stable unique ID for the SVG dissolve filter — useId is pure and SSR-safe; strip ':' for url(#...)
    const filterId = `dissolve-${useId().replace(/:/g, '')}`

    // Idle animation frame cycling
    useEffect(() => {
      if (!idleAnimation || idleAnimation.frames.length <= 1) return
      const interval = Math.round(1000 / idleAnimation.fps)
      frameIntervalRef.current = setInterval(() => {
        setFrameState((state) => {
          const baseFrame = state.descriptorKey === descriptorKey ? state.currentFrame : 0
          return {
            descriptorKey,
            currentFrame: (baseFrame + 1) % idleAnimation.frames.length,
          }
        })
      }, interval)
      return () => {
        if (frameIntervalRef.current) clearInterval(frameIntervalRef.current)
      }
    }, [descriptorKey, idleAnimation])

    useImperativeHandle(ref, () => ({
      triggerAnimation(type, durationMs, isCrit = false, lungeDir) {
        if (animClearRef.current) clearTimeout(animClearRef.current)
        setActiveAnimation((prev) => ({ id: (prev?.id ?? 0) + 1, type, isCrit, durationMs, lungeDir }))
        if (type === 'hurt') {
          hitFlashIdRef.current += 1
          const id = hitFlashIdRef.current
          setHitFlashes((prev) => [...prev, { id, isCrit, durationMs }])
          const flashTimer = setTimeout(() => {
            setHitFlashes((prev) => prev.filter((flash) => flash.id !== id))
          }, durationMs)
          hitFlashTimersRef.current.push(flashTimer)
        }
        animClearRef.current = setTimeout(() => {
          setActiveAnimation(null)
          if (type === 'faint') setHasFainted(true)
          animClearRef.current = null
        }, durationMs)
      },
      triggerAnticipation(direction, durationMs, heavy = false) {
        if (anticipationTimerRef.current) clearTimeout(anticipationTimerRef.current)
        setActiveAnticipation((prev) => ({
          id: (prev?.id ?? 0) + 1,
          direction,
          durationMs,
          heavy,
        }))
        anticipationTimerRef.current = setTimeout(() => {
          setActiveAnticipation(null)
          anticipationTimerRef.current = null
        }, durationMs)
      },
      triggerChargeGlow() {
        if (chargeTimerRef.current) clearTimeout(chargeTimerRef.current)
        setIsCharging(true)
        chargeTimerRef.current = setTimeout(() => {
          setIsCharging(false)
          chargeTimerRef.current = null
        }, BATTLE_ANIM.CHARGE_GLOW_MS + BATTLE_ANIM.LUNGE_MS)
      },
      triggerHealGlow() {
        if (healGlowTimerRef.current) clearTimeout(healGlowTimerRef.current)
        setIsHealing(true)
        healGlowTimerRef.current = setTimeout(() => {
          setIsHealing(false)
          healGlowTimerRef.current = null
        }, BATTLE_ANIM.HEAL_GLOW_MS)
      },
      triggerFocusGlow() {
        if (focusGlowTimerRef.current) clearTimeout(focusGlowTimerRef.current)
        setIsFocusing(true)
        focusGlowTimerRef.current = setTimeout(() => {
          setIsFocusing(false)
          focusGlowTimerRef.current = null
        }, BATTLE_ANIM.FOCUS_CHARGE_MS)
      },
    }))

    useEffect(() => {
      const hitFlashTimers = hitFlashTimersRef
      return () => {
        if (animClearRef.current) clearTimeout(animClearRef.current)
        hitFlashTimers.current.forEach(clearTimeout)
        if (chargeTimerRef.current) clearTimeout(chargeTimerRef.current)
        if (healGlowTimerRef.current) clearTimeout(healGlowTimerRef.current)
        if (focusGlowTimerRef.current) clearTimeout(focusGlowTimerRef.current)
        if (anticipationTimerRef.current) clearTimeout(anticipationTimerRef.current)
        if (frameIntervalRef.current) clearInterval(frameIntervalRef.current)
      }
    }, [])

    // Determine transform: flip is an XOR with the source facing direction
    const shouldFlip = descriptor
      ? flip !== (descriptor.facing === 'left')
      : flip

    const transform = shouldFlip ? 'scaleX(-1)' : undefined

    const lungeAnimation = activeAnimation?.type === 'attack' && activeAnimation.lungeDir
      ? `battle-lunge-${activeAnimation.lungeDir} ${activeAnimation.durationMs}ms ease-out forwards`
      : undefined

    // Recoil: target nudges away from the attacker on contact.
    // lungeDir on a 'hurt' event is the direction away from the attacker (set by useBattleLogReveal).
    const recoilAnimation = activeAnimation?.type === 'hurt' && activeAnimation.lungeDir
      ? `battle-hurt-recoil-${activeAnimation.lungeDir} ${activeAnimation.durationMs}ms ease-out forwards`
      : undefined

    const chargeGlowAnimation = isCharging
      ? `charge-glow ${BATTLE_ANIM.CHARGE_GLOW_MS}ms ease-in forwards`
      : undefined

    const healGlowAnimation = isHealing
      ? `heal-glow ${BATTLE_ANIM.HEAL_GLOW_MS}ms ease-out forwards`
      : undefined

    const focusGlowAnimation = isFocusing
      ? `focus-glow ${BATTLE_ANIM.FOCUS_CHARGE_MS}ms ease-out forwards`
      : undefined

    const anticipationAnimation = activeAnticipation
      ? `battle-anticipate-${activeAnticipation.heavy ? 'heavy-' : ''}${activeAnticipation.direction} ${activeAnticipation.durationMs}ms ease-out forwards`
      : undefined

    // Transform-only animations go on the container; filter-only animations go on the inner
    // glow wrapper. Heavy anticipation animates both transform and filter — keeping it on the
    // container means the charge/focus/heal glows on the glow wrapper are always independent
    // and never fight for the same property on the same element.
    const transformAnimation = [lungeAnimation, recoilAnimation, anticipationAnimation].filter(Boolean).join(', ') || undefined
    const glowAnimation = [chargeGlowAnimation, healGlowAnimation, focusGlowAnimation].filter(Boolean).join(', ') || undefined

    const containerStyle: React.CSSProperties = {
      position: 'relative',
      width: displaySize,
      height: displaySize,
      display: 'inline-block',
      flexShrink: 0,
      ...(hasFainted ? { visibility: 'hidden' } : {}),
      ...(transformAnimation ? { animation: transformAnimation } : {}),
    }

    const glowWrapperStyle: React.CSSProperties = {
      position: 'absolute',
      inset: 0,
      ...(glowAnimation ? { animation: glowAnimation } : {}),
    }

    const imgStyle: React.CSSProperties = {
      display: 'block',
      transform,
      ...(pixelArt && { imageRendering: 'pixelated' as React.CSSProperties['imageRendering'] }),
    }

    const frameUrl =
      descriptor && idleAnimation && idleAnimation.frames.length > 0
        ? idleAnimation.frames[currentFrame]
        : descriptor?.url ?? null

    const hitFlashStyle: React.CSSProperties =
      frameUrl != null
        ? {
            WebkitMaskImage: `url(${JSON.stringify(frameUrl)})`,
            WebkitMaskSize: 'contain',
            WebkitMaskPosition: 'center',
            WebkitMaskRepeat: 'no-repeat',
            maskImage: `url(${JSON.stringify(frameUrl)})`,
            maskSize: 'contain',
            maskPosition: 'center',
            maskRepeat: 'no-repeat',
          }
        : {}

    // Idle animation wrappers — only active when a real sprite is loaded and not fainted.
    // Each animation (sway, breathe) gets its own element to avoid transform conflicts.
    // Hit flashes and faint overlays are siblings outside this stack so they don't inherit transforms.
    const idleActive = !!idleConfig && !hasFainted && !!frameUrl

    const swayClass = idleActive && idleConfig.sway ? 'animate-sprite-sway' : undefined
    const swayStyle: React.CSSProperties = idleActive && idleConfig.sway
      ? {
          position: 'absolute',
          inset: 0,
          '--idle-sway-duration': `${idleConfig.sway.durationS}s`,
          '--idle-sway-angle': idleConfig.sway.angleDeg,
          '--idle-sway-delay': `${idleConfig.sway.delayS}s`,
        } as React.CSSProperties
      : { position: 'absolute', inset: 0 }

    const breatheClass = idleActive && idleConfig.breathe
      ? (idleConfig.breathe.distress ? 'animate-sprite-breathe-distress' : 'animate-sprite-breathe')
      : undefined
    const breatheStyle: React.CSSProperties = idleActive && idleConfig.breathe
      ? {
          position: 'absolute',
          inset: 0,
          '--idle-breathe-duration': `${idleConfig.breathe.durationS}s`,
          '--idle-breathe-scale': idleConfig.breathe.scale,
          ...(idleConfig.breathe.distress
            ? { '--idle-breathe-compress': idleConfig.breathe.compressScale }
            : {}),
        } as React.CSSProperties
      : { position: 'absolute', inset: 0 }

    return (
      <div style={containerStyle} className={className}>
        {/* Inline SVG filter for the noise dissolve — only mounted during faint.
            feTurbulence generates fractal noise; feColorMatrix thresholds it into
            a binary mask; feComposite clips SourceGraphic to that mask.
            SMIL <animate> shifts the threshold from mostly-opaque → fully-transparent
            over 1 s, starting 0.4 s after mount (after the blink phase ends). */}
        {activeAnimation?.type === 'faint' && (
          <svg
            width={0}
            height={0}
            style={{ position: 'absolute', overflow: 'hidden' }}
            aria-hidden="true"
          >
            <defs>
              <filter
                id={filterId}
                x="0%"
                y="0%"
                width="100%"
                height="100%"
                colorInterpolationFilters="sRGB"
              >
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.035"
                  numOctaves="2"
                  seed="7"
                  result="noise"
                />
                <feColorMatrix
                  in="noise"
                  type="matrix"
                  result="mask"
                  values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 40 -4"
                >
                  {/* Animate alpha threshold: -4 → -46 erases all pixels over 1 s */}
                  <animate
                    attributeName="values"
                    values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 40 -4;0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 40 -46"
                    dur="1s"
                    begin="0.4s"
                    fill="freeze"
                  />
                </feColorMatrix>
                <feComposite in="SourceGraphic" in2="mask" operator="in" />
              </filter>
            </defs>
          </svg>
        )}

        {/* Idle animation stack — sway (outer) → breathe (inner) → glow → img.
            Each layer animates a single transform property so they compose cleanly.
            Siblings (hit flashes, faint overlay) are outside this stack so they
            don't inherit any idle transforms. */}
        <div className={swayClass} style={swayStyle}>
        <div className={breatheClass} style={breatheStyle}>
        <div style={glowWrapperStyle}>
          {frameUrl ? (
            <img
              src={frameUrl}
              width={displaySize}
              height={displaySize}
              draggable={false}
              alt=""
              className={pixelArt ? 'sprite-pixel-art block' : 'block'}
              style={{
                ...imgStyle,
                width: displaySize,
                height: displaySize,
                objectFit: 'contain',
                ...(activeAnimation?.type === 'faint' ? { filter: `url(#${filterId})` } : {}),
              }}
            />
          ) : (
            <div style={{ transform }}>
              <SpritePlaceholder size={displaySize} />
            </div>
          )}
        </div>{/* glowWrapper */}
        </div>{/* breathe */}
        </div>{/* sway */}

        {/* Hurt flashes are queued so rapid multi-hit attacks do not replace the previous flash. */}
        {hitFlashes.map((flash) => (
          <div
            key={flash.id}
            data-testid="battle-hit-flash"
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              transform,
              background: 'white',
              animation: flash.isCrit
                ? `hit-flash-crit ${flash.durationMs}ms ease-out forwards`
                : `hit-flash ${flash.durationMs}ms ease-out forwards`,
              pointerEvents: 'none',
              ...hitFlashStyle,
            }}
          />
        ))}

        {/* Faint overlay blinks before the dissolve starts. */}
        {activeAnimation?.type === 'faint' && (
          <div
            key={activeAnimation.id}
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              transform,
              background: 'white',
              animation: `faint-blink ${BATTLE_ANIM.FAINT_BLINK_MS}ms linear forwards`,
              pointerEvents: 'none',
              ...hitFlashStyle,
            }}
          />
        )}
      </div>
    )
  },
)

export default CreatureSprite
