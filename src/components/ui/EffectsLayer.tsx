import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { BATTLE_ANIM } from '@/lib/battleAnimationConfig'

export interface EffectsLayerHandle {
  showDamageNumber(value: number, isCrit: boolean): void
  showCritBadge(): void
  showHitImpact(): void
}

interface FloatingNumber {
  id: number
  value: number
  isCrit: boolean
}

interface CritBadge {
  id: number
}

interface HitImpact {
  id: number
}

interface EffectsLayerProps {
  /** URL of the hit impact PNG. If omitted, showHitImpact() is a no-op. */
  hitImpactUrl?: string
  /** Sprite stage box size (same as SpriteStage `displaySize`) — scales hit impact and keeps floated UI centred. */
  displaySize?: number
}

let _id = 0
function nextId() {
  return ++_id
}

const IMPACT_DURATION_MS = BATTLE_ANIM.HIT_IMPACT_MS

function impactGraphicSize(displaySize: number | undefined): number {
  if (displaySize == null) return 96
  return Math.round(Math.min(120, Math.max(72, displaySize * 0.37)))
}

const EffectsLayer = forwardRef<EffectsLayerHandle, EffectsLayerProps>(
  function EffectsLayer({ hitImpactUrl, displaySize }, ref) {
    const impactPx = impactGraphicSize(displaySize)
    const [numbers, setNumbers] = useState<FloatingNumber[]>([])
    const [crits, setCrits] = useState<CritBadge[]>([])
    const [impacts, setImpacts] = useState<HitImpact[]>([])
    const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

    useEffect(() => {
      const timersContainer = timersRef
      return () => {
        const timeouts = timersContainer.current
        timeouts.forEach(clearTimeout)
      }
    }, [])

    useImperativeHandle(ref, () => ({
      showDamageNumber(value, isCrit) {
        const id = nextId()
        setNumbers((prev) => [...prev, { id, value, isCrit }])
        const t = setTimeout(() => {
          setNumbers((prev) => prev.filter((n) => n.id !== id))
        }, BATTLE_ANIM.DAMAGE_NUMBER_MS)
        timersRef.current.push(t)
      },
      showCritBadge() {
        const id = nextId()
        setCrits((prev) => [...prev, { id }])
        const t = setTimeout(() => {
          setCrits((prev) => prev.filter((c) => c.id !== id))
        }, BATTLE_ANIM.CRIT_BADGE_MS)
        timersRef.current.push(t)
      },
      showHitImpact() {
        if (!hitImpactUrl) return
        const id = nextId()
        setImpacts((prev) => [...prev, { id }])
        const t = setTimeout(() => {
          setImpacts((prev) => prev.filter((h) => h.id !== id))
        }, IMPACT_DURATION_MS)
        timersRef.current.push(t)
      },
    }))

    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'visible',
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      >
        {/* Floating damage numbers */}
        {numbers.map((n) => (
          <div
            key={n.id}
            style={{
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                animation: `float-up ${BATTLE_ANIM.DAMAGE_NUMBER_MS}ms ease-out forwards`,
                fontWeight: 700,
                fontSize: n.isCrit ? 28 : 20,
                lineHeight: 1,
                color: n.isCrit ? 'var(--app-warning)' : 'var(--app-text-primary)',
                textShadow: '0 2px 5px rgba(0,0,0,0.4)',
                whiteSpace: 'nowrap',
              }}
            >
              {n.value}
            </div>
          </div>
        ))}

        {/* Hit impact PNG */}
        {hitImpactUrl && impacts.map((h) => (
          <div
            key={h.id}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: impactPx,
              height: impactPx,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
            }}
          >
            <img
              src={hitImpactUrl}
              alt=""
              draggable={false}
              style={{
                display: 'block',
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                animation: `hit-impact ${IMPACT_DURATION_MS}ms ease-out forwards`,
                pointerEvents: 'none',
              }}
            />
          </div>
        ))}

        {/* Crit badge */}
        {crits.map((c) => (
          <div
            key={c.id}
            style={{
              position: 'absolute',
              bottom: '110%',
              left: '50%',
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                animation: `crit-pop ${BATTLE_ANIM.CRIT_BADGE_MS}ms ease-out forwards`,
                fontWeight: 800,
                fontSize: 11,
                letterSpacing: '0.08em',
                color: 'var(--app-warning)',
                textShadow: '0 1px 3px rgba(0,0,0,0.4)',
                whiteSpace: 'nowrap',
              }}
            >
              CRIT!
            </div>
          </div>
        ))}
      </div>
    )
  },
)

export default EffectsLayer
