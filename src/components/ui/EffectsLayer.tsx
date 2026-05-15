import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { BATTLE_ANIM } from '@/lib/battleAnimationConfig'
import { ImpactGraphic, type ImpactVariant } from './ImpactGraphic'

export interface EffectsLayerHandle {
  showDamageNumber(value: number, isCrit: boolean): void
  showCritBadge(): void
  showAttackImpact(isCrit?: boolean): void
  showHeavyAttackImpact(isCrit?: boolean): void
  showFocusedAttackImpact(isCrit?: boolean, hitCount?: number, spacingMs?: number): void
  showGroundShockwave(): void
  /** @deprecated Use showAttackImpact(). */
  showHitImpact(): void
  showDefendGuard(durationMs?: number): void
  showFocusCharge(): void
  showFocusSpend(pipCount: number): void
  showHealEffect(value: number): void
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
  variant: ImpactVariant
  angle: number
}

interface GuardEffect {
  id: number
  durationMs: number
}

interface FocusEffect {
  id: number
}

interface FocusSpendEffect {
  id: number
  pipCount: number
}

interface HealEffect {
  id: number
  value: number
}

interface ShockwaveEffect {
  id: number
}

interface EffectsLayerProps {
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
  function EffectsLayer({ displaySize }, ref) {
    const impactPx = impactGraphicSize(displaySize)
    const [numbers, setNumbers] = useState<FloatingNumber[]>([])
    const [crits, setCrits] = useState<CritBadge[]>([])
    const [impacts, setImpacts] = useState<HitImpact[]>([])
    const [guards, setGuards] = useState<GuardEffect[]>([])
    const [focuses, setFocuses] = useState<FocusEffect[]>([])
    const [focusSpends, setFocusSpends] = useState<FocusSpendEffect[]>([])
    const [heals, setHeals] = useState<HealEffect[]>([])
    const [shockwaves, setShockwaves] = useState<ShockwaveEffect[]>([])
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

    function addDelayedTimedEffect<T extends { id: number }>(
      setEffects: Dispatch<SetStateAction<T[]>>,
      effect: T,
      delayMs: number,
      durationMs: number,
    ) {
      if (delayMs <= 0) {
        addTimedEffect(setEffects, effect, durationMs)
        return
      }
      const t = setTimeout(() => {
        addTimedEffect(setEffects, effect, durationMs)
      }, delayMs)
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
        const id = nextId()
        addTimedEffect(setImpacts, {
          id, isCrit, delayMs: 0, xPct: 50, yPct: 50,
          variant: 'slash',
          angle: Math.round((Math.random() - 0.5) * 40),
        }, IMPACT_DURATION_MS)
      },
      showHeavyAttackImpact(isCrit = false) {
        const id = nextId()
        addTimedEffect(setImpacts, {
          id, isCrit, delayMs: 0, xPct: 50, yPct: 52,
          variant: 'burst',
          angle: Math.round((Math.random() - 0.5) * 18),
        }, IMPACT_DURATION_MS + BATTLE_ANIM.HIT_STOP_MS)
      },
      showFocusedAttackImpact(isCrit = false, hitCount = 3, spacingMs = BATTLE_ANIM.FOCUSED_HIT_SPACING_MS) {
        const pattern = [
          { xPct: 39, yPct: 57, angle: -18 },
          { xPct: 60, yPct: 39, angle: 18 },
          { xPct: 49, yPct: 62, angle: -4 },
          { xPct: 35, yPct: 43, angle: 28 },
          { xPct: 64, yPct: 58, angle: -26 },
        ]
        const hitOffsets = Array.from({ length: Math.max(1, Math.min(hitCount, pattern.length)) }, (_, index) => ({
          delayMs: spacingMs * index,
          ...pattern[index],
        }))
        hitOffsets.forEach((hit) => {
          const id = nextId()
          addDelayedTimedEffect(
            setImpacts,
            { id, isCrit, ...hit, delayMs: 0, variant: 'arc' as ImpactVariant },
            hit.delayMs,
            IMPACT_DURATION_MS,
          )
        })
      },
      showHitImpact() {
        const id = nextId()
        addTimedEffect(setImpacts, { id, isCrit: false, delayMs: 0, xPct: 50, yPct: 50, variant: 'slash', angle: 0 }, IMPACT_DURATION_MS)
      },
      showDefendGuard(durationMs = BATTLE_ANIM.DEFEND_GUARD_MS) {
        const id = nextId()
        addTimedEffect(setGuards, { id, durationMs }, durationMs)
      },
      showFocusCharge() {
        const id = nextId()
        addTimedEffect(setFocuses, { id }, BATTLE_ANIM.FOCUS_CHARGE_MS)
      },
      showFocusSpend(pipCount) {
        const id = nextId()
        addTimedEffect(setFocusSpends, { id, pipCount: Math.max(1, Math.min(pipCount, 5)) }, BATTLE_ANIM.FOCUS_SPEND_MS)
      },
      showHealEffect(value) {
        const id = nextId()
        addTimedEffect(setHeals, { id, value }, BATTLE_ANIM.HEAL_EFFECT_MS)
      },
      showGroundShockwave() {
        const id = nextId()
        addTimedEffect(setShockwaves, { id }, BATTLE_ANIM.GROUND_SHOCKWAVE_MS)
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

        {/* SVG impact graphic */}
        {impacts.map((h) => (
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
            <ImpactGraphic
              variant={h.variant}
              size={impactPx}
              isCrit={h.isCrit}
              angle={h.angle}
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
                animation: `battle-guard-ring ${g.durationMs}ms steps(5, end) forwards`,
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
                  animation: `battle-guard-spark ${g.durationMs}ms steps(4, end) forwards`,
                  animationDelay: `${spark * 70}ms`,
                }}
              />
            ))}
          </div>
        ))}

        {/* FP spend — amber pips collapse toward the sprite core before skill contact */}
        {focusSpends.map((effect) => (
          <div
            key={effect.id}
            data-testid="battle-focus-spend"
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          >
            {Array.from({ length: effect.pipCount }).map((_, i) => {
              const offset = i - (effect.pipCount - 1) / 2
              return (
                <span
                  key={i}
                  style={{
                    position: 'absolute',
                    left: `${50 + offset * 12}%`,
                    bottom: '16%',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#facc15',
                    boxShadow: '0 0 8px rgba(250,204,21,0.9), 0 0 14px rgba(245,158,11,0.5)',
                    animation: `battle-focus-spend ${BATTLE_ANIM.FOCUS_SPEND_MS}ms ease-in forwards`,
                    animationDelay: `${i * 24}ms`,
                  }}
                />
              )
            })}
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

        {/* Heal effect — green regen aura + rising sparks + floating +N */}
        {heals.map((h) => (
          <div
            key={h.id}
            data-testid="battle-heal-effect"
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          >
            <div
              style={{
                position: 'absolute',
                left: '50%',
                bottom: '7%',
                width: '78%',
                height: '42%',
                borderRadius: '50%',
                background: 'radial-gradient(ellipse, rgba(74,222,128,0.55) 0%, rgba(34,197,94,0.24) 48%, transparent 72%)',
                transform: 'translateX(-50%)',
                animation: `battle-focus-aura ${BATTLE_ANIM.HEAL_EFFECT_MS}ms steps(6, end) forwards`,
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
                  background: spark % 2 === 0 ? '#bbf7d0' : '#4ade80',
                  boxShadow: '0 0 0 1px rgba(21,128,61,0.6)',
                  animation: `battle-focus-spark ${BATTLE_ANIM.HEAL_EFFECT_MS}ms steps(5, end) forwards`,
                  animationDelay: `${spark * 55}ms`,
                }}
              />
            ))}
            <div
              style={{
                position: 'absolute',
                bottom: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
              }}
            >
              <div
                style={{
                  animation: `float-up ${BATTLE_ANIM.HEAL_EFFECT_MS}ms ease-out forwards`,
                  fontWeight: 700,
                  fontSize: 20,
                  lineHeight: 1,
                  color: '#4ade80',
                  textShadow: '0 2px 5px rgba(0,0,0,0.4)',
                  whiteSpace: 'nowrap',
                }}
              >
                +{h.value}
              </div>
            </div>
          </div>
        ))}

        {/* Ground shockwave — violet ellipse at feet for power_strike */}
        {shockwaves.map((s) => (
          <div
            key={s.id}
            data-testid="battle-ground-shockwave"
            style={{
              position: 'absolute',
              bottom: '6%',
              left: '50%',
              width: '68%',
              height: '18%',
              border: '3px solid rgba(139,92,246,0.9)',
              borderRadius: '50%',
              boxShadow: '0 0 10px rgba(139,92,246,0.7), 0 0 20px rgba(109,40,217,0.4)',
              transform: 'translate(-50%, -50%) scale(0.1)',
              pointerEvents: 'none',
              animation: `ground-shockwave ${BATTLE_ANIM.GROUND_SHOCKWAVE_MS}ms ease-out forwards`,
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
