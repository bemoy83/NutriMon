import { forwardRef, useImperativeHandle, useRef, useState } from 'react'

export interface EffectsLayerHandle {
  showDamageNumber(value: number, isCrit: boolean): void
  showCritBadge(): void
}

interface FloatingNumber {
  id: number
  value: number
  isCrit: boolean
}

interface CritBadge {
  id: number
}

let _id = 0
function nextId() {
  return ++_id
}

const EffectsLayer = forwardRef<EffectsLayerHandle>(
  function EffectsLayer(_props, ref) {
    const [numbers, setNumbers] = useState<FloatingNumber[]>([])
    const [crits, setCrits] = useState<CritBadge[]>([])
    const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

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
