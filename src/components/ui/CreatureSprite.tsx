import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { AnimationDescriptor, SpriteDescriptor } from '@/lib/sprites'

export interface CreatureSpriteHandle {
  triggerAnimation(type: 'hurt' | 'faint' | 'attack', durationMs: number): void
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
    const [activeAnimation, setActiveAnimation] = useState<'hurt' | 'faint' | 'attack' | null>(null)
    const descriptorKey = descriptor ? `${descriptor.url}:${descriptor.facing}` : 'placeholder'
    const [frameState, setFrameState] = useState({ descriptorKey, currentFrame: 0 })
    const animClearRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const currentFrame = frameState.descriptorKey === descriptorKey ? frameState.currentFrame : 0

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
      triggerAnimation(type, durationMs) {
        if (animClearRef.current) clearTimeout(animClearRef.current)
        setActiveAnimation(type)
        animClearRef.current = setTimeout(() => {
          setActiveAnimation(null)
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

    // Faint = fade + slide down
    const faintStyle =
      activeAnimation === 'faint'
        ? { opacity: 0.2, transform: `${transform ?? ''} translateY(8px)`.trim(), transition: 'opacity 800ms ease, transform 800ms ease' }
        : {}

    const containerStyle: React.CSSProperties = {
      position: 'relative',
      width: displaySize,
      height: displaySize,
      display: 'inline-block',
      flexShrink: 0,
      ...faintStyle,
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
        {frameUrl ? (
          <img
            src={frameUrl}
            width={displaySize}
            height={displaySize}
            draggable={false}
            alt=""
            className={pixelArt ? 'sprite-pixel-art block' : 'block'}
            style={{ ...imgStyle, width: displaySize, height: displaySize, objectFit: 'contain' }}
          />
        ) : (
          <div style={{ transform }}>
            <SpritePlaceholder size={displaySize} />
          </div>
        )}

        {/* Hit flash: masked to sprite alpha so flash follows the creature silhouette */}
        {activeAnimation === 'hurt' && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              transform,
              background: 'white',
              animation: 'hit-flash 500ms ease-out forwards',
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
