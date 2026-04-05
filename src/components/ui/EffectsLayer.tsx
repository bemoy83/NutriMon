import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

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
}

let _id = 0
function nextId() {
  return ++_id
}

const IMPACT_DURATION_MS = 350

const EffectsLayer = forwardRef<EffectsLayerHandle, EffectsLayerProps>(
  function EffectsLayer({ hitImpactUrl }, ref) {
    const [numbers, setNumbers] = useState<FloatingNumber[]>([])
    const [crits, setCrits] = useState<CritBadge[]>([])
    const [impacts, setImpacts] = useState<HitImpact[]>([])
    const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

    useEffect(() => {
      return () => timersRef.current.forEach(clearTimeout)
    }, [])

    useImperativeHandle(ref, () => ({
      showDamageNumber(value, isCrit) {
        const id = nextId()
        setNumbers((prev) => [...prev, { id, value, isCrit }])
        const t = setTimeout(() => {
          setNumbers((prev) => prev.filter((n) => n.id !== id))
        }, 1000)
        timersRef.current.push(t)
      },
      showCritBadge() {
        const id = nextId()
        setCrits((prev) => [...prev, { id }])
        const t = setTimeout(() => {
          setCrits((prev) => prev.filter((c) => c.id !== id))
        }, 900)
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
              animation: 'float-up 1000ms ease-out forwards',
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
        ))}

        {/* Hit impact PNG */}
        {hitImpactUrl && impacts.map((h) => (
          <img
            key={h.id}
            src={hitImpactUrl}
            alt=""
            draggable={false}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: 96,
              height: 96,
              objectFit: 'contain',
              animation: `hit-impact ${IMPACT_DURATION_MS}ms ease-out forwards`,
              pointerEvents: 'none',
            }}
          />
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
              animation: 'crit-pop 900ms ease-out forwards',
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
        ))}
      </div>
    )
  },
)

export default EffectsLayer
