import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react'
import type { AnimationDescriptor, SpriteDescriptor } from '@/lib/sprites'

export interface CreatureSpriteHandle {
  triggerAnimation(type: 'hurt' | 'faint' | 'attack', durationMs: number, isCrit?: boolean): void
}

interface CreatureSpriteProps {
  descriptor: SpriteDescriptor | null
  displaySize: number
  /** true = apply scaleX(-1) to flip the sprite horizontally */
  flip?: boolean
  idleAnimation?: AnimationDescriptor | null
  className?: string
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
  function CreatureSprite({ descriptor, displaySize, flip = false, idleAnimation, className }, ref) {
    const pixelArt = descriptor?.pixelArt ?? false
    const [activeAnimation, setActiveAnimation] = useState<{ type: 'hurt' | 'faint' | 'attack'; isCrit: boolean } | null>(null)
    const [hasFainted, setHasFainted] = useState(false)
    const descriptorKey = descriptor ? `${descriptor.url}:${descriptor.facing}` : 'placeholder'
    const [prevDescriptorKey, setPrevDescriptorKey] = useState(descriptorKey)
    if (descriptorKey !== prevDescriptorKey) {
      setPrevDescriptorKey(descriptorKey)
      setHasFainted(false)
    }
    const [frameState, setFrameState] = useState({ descriptorKey, currentFrame: 0 })
    const animClearRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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
      triggerAnimation(type, durationMs, isCrit = false) {
        if (animClearRef.current) clearTimeout(animClearRef.current)
        setActiveAnimation({ type, isCrit })
        animClearRef.current = setTimeout(() => {
          setActiveAnimation(null)
          if (type === 'faint') setHasFainted(true)
          animClearRef.current = null
        }, durationMs)
      },
    }))

    useEffect(() => {
      return () => {
        if (animClearRef.current) clearTimeout(animClearRef.current)
        if (frameIntervalRef.current) clearInterval(frameIntervalRef.current)
      }
    }, [])

    // Determine transform: flip is an XOR with the source facing direction
    const shouldFlip = descriptor
      ? flip !== (descriptor.facing === 'left')
      : flip

    const transform = shouldFlip ? 'scaleX(-1)' : undefined

    const containerStyle: React.CSSProperties = {
      position: 'relative',
      width: displaySize,
      height: displaySize,
      display: 'inline-block',
      flexShrink: 0,
      ...(hasFainted ? { visibility: 'hidden' } : {}),
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

        {/* White flash overlay masked to sprite silhouette.
            hurt  → single bright flash (hit-flash keyframes)
            faint → 3 rapid blinks before the dissolve starts (faint-blink keyframes) */}
        {(activeAnimation?.type === 'hurt' || activeAnimation?.type === 'faint') && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              transform,
              background: activeAnimation.isCrit ? '#fbbf24' : 'white',
              animation:
                activeAnimation.type === 'hurt'
                  ? (activeAnimation.isCrit
                      ? 'hit-flash-crit 550ms ease-out forwards'
                      : 'hit-flash 500ms ease-out forwards')
                  : 'faint-blink 400ms linear forwards',
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
