import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { BATTLE_ANIM } from '@/lib/battleAnimationConfig'

export interface EffectsLayerHandle {
  showDamageNumber(value: number, isCrit: boolean): void
  showCritBadge(): void
  showAttackImpact(isCrit?: boolean): void
  showFocusedAttackImpact(isCrit?: boolean): void
  /** @deprecated Use showAttackImpact(). */
  showHitImpact(): void
  showDefendGuard(): void
  showFocusCharge(): void
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
  isCrit: boolean
  delayMs: number
  xPct: number
  yPct: number
}

interface GuardEffect {
  id: number
}

interface FocusEffect {
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
    const [guards, setGuards] = useState<GuardEffect[]>([])
    const [focuses, setFocuses] = useState<FocusEffect[]>([])
    const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

    function addTimedEffect<T extends { id: number }>(
      setEffects: Dispatch<SetStateAction<T[]>>,
      effect: T,
      durationMs: number,
    ) {
      setEffects((prev) => [...prev, effect])
      const t = setTimeout(() => {
        setEffects((prev) => prev.filter((item) => item.id !== effect.id))
      }, durationMs)
      timersRef.current.push(t)
    }

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
        addTimedEffect(setCrits, { id }, BATTLE_ANIM.CRIT_BADGE_MS)
      },
      showAttackImpact(isCrit = false) {
        if (!hitImpactUrl) return
        const id = nextId()
        addTimedEffect(setImpacts, { id, isCrit, delayMs: 0, xPct: 50, yPct: 50 }, IMPACT_DURATION_MS)
      },
      showFocusedAttackImpact(isCrit = false) {
        if (!hitImpactUrl) return
        const hitOffsets = [
          { delayMs: 0, xPct: 45, yPct: 52 },
          { delayMs: 90, xPct: 56, yPct: 44 },
          { delayMs: 180, xPct: 51, yPct: 57 },
        ]
        hitOffsets.forEach((hit) => {
          const id = nextId()
          addTimedEffect(setImpacts, { id, isCrit, ...hit }, IMPACT_DURATION_MS + hit.delayMs)
        })
      },
      showHitImpact() {
        if (!hitImpactUrl) return
        const id = nextId()
        addTimedEffect(setImpacts, { id, isCrit: false, delayMs: 0, xPct: 50, yPct: 50 }, IMPACT_DURATION_MS)
      },
      showDefendGuard() {
        const id = nextId()
        addTimedEffect(setGuards, { id }, BATTLE_ANIM.DEFEND_GUARD_MS)
      },
      showFocusCharge() {
        const id = nextId()
        addTimedEffect(setFocuses, { id }, BATTLE_ANIM.FOCUS_CHARGE_MS)
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
            data-testid="battle-attack-impact"
            style={{
              position: 'absolute',
              top: `${h.yPct}%`,
              left: `${h.xPct}%`,
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
                animationDelay: `${h.delayMs}ms`,
                filter: h.isCrit ? 'drop-shadow(0 0 7px rgba(251,191,36,0.9)) saturate(1.25)' : undefined,
                pointerEvents: 'none',
              }}
            />
          </div>
        ))}

        {/* Defend guard ring */}
        {guards.map((g) => (
          <div
            key={g.id}
            data-testid="battle-defend-guard"
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '47%',
                left: '50%',
                width: '72%',
                height: '58%',
                border: '3px solid rgba(125, 211, 252, 0.95)',
                borderRadius: '50%',
                boxShadow: '0 0 0 2px rgba(30, 64, 175, 0.55), inset 0 0 12px rgba(186, 230, 253, 0.45)',
                transform: 'translate(-50%, -50%)',
                animation: `battle-guard-ring ${BATTLE_ANIM.DEFEND_GUARD_MS}ms steps(5, end) forwards`,
              }}
            />
            {[0, 1, 2].map((spark) => (
              <span
                key={spark}
                style={{
                  position: 'absolute',
                  top: `${spark === 0 ? 29 : spark === 1 ? 43 : 59}%`,
                  left: `${spark === 0 ? 31 : spark === 1 ? 70 : 38}%`,
                  width: 6,
                  height: 6,
                  background: '#e0f2fe',
                  boxShadow: '0 0 0 1px rgba(14, 116, 144, 0.8)',
                  animation: `battle-guard-spark ${BATTLE_ANIM.DEFEND_GUARD_MS}ms steps(4, end) forwards`,
                  animationDelay: `${spark * 70}ms`,
                }}
              />
            ))}
          </div>
        ))}

        {/* Focus charge aura */}
        {focuses.map((f) => (
          <div
            key={f.id}
            data-testid="battle-focus-charge"
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: '50%',
                bottom: '7%',
                width: '78%',
                height: '42%',
                borderRadius: '50%',
                background: 'radial-gradient(ellipse, rgba(253,224,71,0.55) 0%, rgba(251,191,36,0.24) 48%, transparent 72%)',
                transform: 'translateX(-50%)',
                animation: `battle-focus-aura ${BATTLE_ANIM.FOCUS_CHARGE_MS}ms steps(6, end) forwards`,
              }}
            />
            {[0, 1, 2, 3].map((spark) => (
              <span
                key={spark}
                style={{
                  position: 'absolute',
                  bottom: `${spark % 2 === 0 ? 21 : 28}%`,
                  left: `${28 + spark * 13}%`,
                  width: 5,
                  height: 9,
                  background: spark % 2 === 0 ? '#fef08a' : '#facc15',
                  boxShadow: '0 0 0 1px rgba(161, 98, 7, 0.6)',
                  animation: `battle-focus-spark ${BATTLE_ANIM.FOCUS_CHARGE_MS}ms steps(5, end) forwards`,
                  animationDelay: `${spark * 55}ms`,
                }}
              />
            ))}
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
