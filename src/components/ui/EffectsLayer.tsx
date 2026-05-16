import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { BATTLE_ANIM } from '@/lib/battleAnimationConfig'
import { ImpactGraphic, type ImpactVariant } from './ImpactGraphic'

export interface EffectsLayerHandle {
  showDamageNumber(value: number, isCrit: boolean): void
  showCritBadge(): void
  showAttackImpact(isCrit?: boolean, impactColor?: { stroke: string; glowFilter: string }): void
  showHeavyAttackImpact(isCrit?: boolean, impactColor?: { stroke: string; glowFilter: string }): void
  showFocusedAttackImpact(isCrit?: boolean, hitCount?: number, spacingMs?: number, variant?: ImpactVariant, impactColor?: { stroke: string; glowFilter: string }): void
  showGroundShockwave(wide?: boolean): void
  /** @deprecated Use showAttackImpact(). */
  showHitImpact(): void
  showDefendGuard(durationMs?: number): void
  showFocusCharge(): void
  showFocusSpend(pipCount: number): void
  showHealEffect(value: number): void
  /** Overdrive: fuchsia horizontal streak per hit beat. */
  showOverdriveStreak(): void
  /** Regen V2: green particles orbit inward before the +HP number. */
  showRegenOrbitEffect(value: number): void
  /** Charge Strike V2: pips converge into sprite center. */
  showChargeStrikeSpend(pipCount: number): void
  /** Counter Stance V2: looping shield ring that persists until counter fires. */
  showPersistentGuard(): void
  hidePersistentGuard(): void
/** Radial speedlines on the target before a hit lands. */
  showSpeedlines(): void
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
  impactColor?: { stroke: string; glowFilter: string }
}

interface GuardEffect {
  id: number
  durationMs: number
}

interface FocusMote {
  px: number
  py: number
  dx: number
  dy: number
  delayMs: number
  sizePx: number
}

interface FocusEffect {
  id: number
  motes: FocusMote[]
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
  wide: boolean
}

interface OverdriveStreak {
  id: number
  yPct: number
}

interface RegenMote {
  fxPx: number
  delayMs: number
  sizePx: number
}

interface RegenOrbitEffect {
  id: number
  value: number
  motes: RegenMote[]
}

interface ChargeSpendEffect {
  id: number
  pipCount: number
}


interface SpeedlineItem {
  angle: number
  innerPx: number
  lenPx: number
  thickPx: number
  delayMs: number
}

interface SpeedlineEffect {
  id: number
  cx: number
  cy: number
  items: SpeedlineItem[]
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
    const [streaks, setStreaks] = useState<OverdriveStreak[]>([])
    const [regenOrbits, setRegenOrbits] = useState<RegenOrbitEffect[]>([])
    const [chargeSpends, setChargeSpends] = useState<ChargeSpendEffect[]>([])
const [speedlines, setSpeedlines] = useState<SpeedlineEffect[]>([])
    const [persistentGuardState, setPersistentGuardState] = useState<'hidden' | 'active' | 'dismissing'>('hidden')
    const [persistentGuardKey, setPersistentGuardKey] = useState(0)
    const persistentGuardDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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
      const dismissRef = persistentGuardDismissRef
      return () => {
        timersContainer.current.forEach(clearTimeout)
        if (dismissRef.current) clearTimeout(dismissRef.current)
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
      showAttackImpact(isCrit = false, impactColor?) {
        const id = nextId()
        addTimedEffect(setImpacts, {
          id, isCrit, delayMs: 0, xPct: 50, yPct: 50,
          variant: 'slash',
          angle: Math.round((Math.random() - 0.5) * 40),
          impactColor,
        }, IMPACT_DURATION_MS)
      },
      showHeavyAttackImpact(isCrit = false, impactColor?) {
        const id = nextId()
        addTimedEffect(setImpacts, {
          id, isCrit, delayMs: 0, xPct: 50, yPct: 52,
          variant: 'burst',
          angle: Math.round((Math.random() - 0.5) * 18),
          impactColor,
        }, IMPACT_DURATION_MS + BATTLE_ANIM.HIT_STOP_MS)
      },
      showFocusedAttackImpact(isCrit = false, hitCount = 3, spacingMs = BATTLE_ANIM.FOCUSED_HIT_SPACING_MS, variant: ImpactVariant = 'arc', impactColor?) {
        const arcPattern = [
          { xPct: 39, yPct: 57, angle: -18 },
          { xPct: 60, yPct: 39, angle: 18 },
          { xPct: 49, yPct: 62, angle: -4 },
          { xPct: 35, yPct: 43, angle: 28 },
          { xPct: 64, yPct: 58, angle: -26 },
        ]
        // Cut pattern: each hit placed at a distinct body zone with a strong directional angle.
        // The angle rotates the parallel-stroke SVG so each read as a different slash direction.
        const cutPattern = [
          { xPct: 44, yPct: 54, angle: -42 },  // steep down-left
          { xPct: 55, yPct: 40, angle: 38 },   // steep down-right
          { xPct: 50, yPct: 50, angle: -8 },   // near-vertical center
          { xPct: 38, yPct: 46, angle: 55 },
          { xPct: 62, yPct: 58, angle: -32 },
        ]
        const pattern = variant === 'cut' ? cutPattern : arcPattern
        const hitOffsets = Array.from({ length: Math.max(1, Math.min(hitCount, pattern.length)) }, (_, index) => ({
          delayMs: spacingMs * index,
          ...pattern[index],
        }))
        hitOffsets.forEach((hit) => {
          const id = nextId()
          const impact: HitImpact = { id, isCrit, ...hit, delayMs: 0, variant, impactColor }
          addDelayedTimedEffect<HitImpact>(
            setImpacts,
            impact,
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
        const ds = displaySize ?? 128
        const cx = ds / 2
        const cy = ds * 0.44
        const rx = ds * 0.42
        const ry = ds * 0.34
        const count = 8
        const motes: FocusMote[] = Array.from({ length: count }, (_, i) => {
          const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.3
          const r = 0.85 + Math.random() * 0.3
          const px = cx + Math.cos(angle) * rx * r
          const py = cy + Math.sin(angle) * ry * r
          return {
            px,
            py,
            dx: cx - px,
            dy: cy - py,
            delayMs: Math.random() * 180,
            sizePx: Math.random() < 0.35 ? 7 : 5,
          }
        })
        addTimedEffect(setFocuses, { id, motes }, BATTLE_ANIM.FOCUS_CHARGE_MS)
      },
      showFocusSpend(pipCount) {
        const id = nextId()
        addTimedEffect(setFocusSpends, { id, pipCount: Math.max(1, Math.min(pipCount, 5)) }, BATTLE_ANIM.FOCUS_SPEND_MS)
      },
      showHealEffect(value) {
        const id = nextId()
        addTimedEffect(setHeals, { id, value }, BATTLE_ANIM.HEAL_EFFECT_MS)
      },
      showGroundShockwave(wide = false) {
        const id = nextId()
        addTimedEffect(setShockwaves, { id, wide }, BATTLE_ANIM.GROUND_SHOCKWAVE_MS)
      },
      showOverdriveStreak() {
        const id = nextId()
        const yPct = 30 + Math.round(Math.random() * 36)
        addTimedEffect(setStreaks, { id, yPct }, 280)
      },
      showRegenOrbitEffect(value) {
        const id = nextId()
        const ds = displaySize ?? 128
        const motes: RegenMote[] = Array.from({ length: 12 }, () => ({
          fxPx: (Math.random() - 0.5) * ds * 0.72,
          delayMs: Math.random() * 380,
          sizePx: Math.random() < 0.3 ? 6 : 5,
        }))
        addTimedEffect(setRegenOrbits, { id, value, motes }, BATTLE_ANIM.HEAL_EFFECT_MS)
      },
      showChargeStrikeSpend(pipCount) {
        const id = nextId()
        addTimedEffect(setChargeSpends, { id, pipCount: Math.max(1, Math.min(pipCount, 5)) }, BATTLE_ANIM.FOCUS_SPEND_MS)
      },
showSpeedlines() {
        const id = nextId()
        const ds = displaySize ?? 128
        const cx = ds / 2
        const cy = ds * 0.44
        const count = 14
        const items: SpeedlineItem[] = Array.from({ length: count }, (_, i) => ({
          angle: (i / count) * 360 + (Math.random() - 0.5) * 10,
          innerPx: 28 + Math.random() * 14,
          lenPx: 20 + Math.random() * 32,
          thickPx: 1 + Math.random() * 1.8,
          delayMs: Math.random() * 80,
        }))
        addTimedEffect(setSpeedlines, { id, cx, cy, items }, 460)
      },
      showPersistentGuard() {
        if (persistentGuardDismissRef.current) clearTimeout(persistentGuardDismissRef.current)
        setPersistentGuardState('active')
        setPersistentGuardKey((k) => k + 1)
      },
      hidePersistentGuard() {
        setPersistentGuardState((current) => {
          if (current !== 'active') return current
          if (persistentGuardDismissRef.current) clearTimeout(persistentGuardDismissRef.current)
          persistentGuardDismissRef.current = setTimeout(() => {
            setPersistentGuardState('hidden')
            persistentGuardDismissRef.current = null
          }, 400)
          return 'dismissing'
        })
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
                animation: `${n.isCrit ? 'crit-float-up' : 'float-up'} ${BATTLE_ANIM.DAMAGE_NUMBER_MS}ms ease-out forwards`,
                fontWeight: 800,
                fontSize: n.isCrit ? 30 : 20,
                lineHeight: 1,
                color: n.isCrit ? '#ffffff' : 'var(--app-text-primary)',
                textShadow: n.isCrit
                  ? '0 2px 6px rgba(0,0,0,0.55), 0 0 14px rgba(255,255,180,0.8)'
                  : '0 2px 5px rgba(0,0,0,0.4)',
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
              impactColor={h.impactColor}
            />
          </div>
        ))}

        {/* Defend shield dome */}
        {guards.map((g) => {
          const ds = displaySize ?? 128
          const cx = ds / 2
          const cy = ds * 0.44
          const r = ds * 0.46
          const hexPatternId = `vfx-hex-${g.id}`
          const hexGradId = `vfx-hex-grad-${g.id}`
          const hexMaskId = `vfx-hex-mask-${g.id}`
          return (
            <div
              key={g.id}
              data-testid="battle-defend-guard"
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
            >
              {/* Dome — circular shell with edge gradient + hex force-field overlay */}
              <div
                style={{
                  position: 'absolute',
                  left: cx - r,
                  top: cy - r,
                  width: r * 2,
                  height: r * 2,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, transparent 55%, rgba(74,172,223,0.38) 75%, rgba(74,172,223,0.62) 88%, transparent 100%)',
                  border: '2px solid rgba(74,172,223,0.88)',
                  boxShadow: 'inset 0 0 28px rgba(74,172,223,0.48), 0 0 22px rgba(74,172,223,0.42)',
                  animation: `shield-dome-in ${g.durationMs}ms cubic-bezier(0.25,0.8,0.3,1) forwards`,
                  overflow: 'hidden',
                }}
              >
                <svg
                  width="100%"
                  height="100%"
                  style={{ position: 'absolute', inset: 0, opacity: 0.42 }}
                  aria-hidden="true"
                >
                  <defs>
                    <pattern id={hexPatternId} width="16" height="14" patternUnits="userSpaceOnUse">
                      <polygon
                        points="8,1 15,4.5 15,10.5 8,14 1,10.5 1,4.5"
                        fill="none"
                        stroke="rgba(74,172,223,0.9)"
                        strokeWidth="0.6"
                      />
                    </pattern>
                    <radialGradient id={hexGradId}>
                      <stop offset="0%"   stopColor="white" stopOpacity="0" />
                      <stop offset="60%"  stopColor="white" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="white" stopOpacity="1" />
                    </radialGradient>
                    <mask id={hexMaskId}>
                      <rect width="100%" height="100%" fill={`url(#${hexGradId})`} />
                    </mask>
                  </defs>
                  <rect width="100%" height="100%" fill={`url(#${hexPatternId})`} mask={`url(#${hexMaskId})`} />
                </svg>
              </div>

              {/* Aura ring — single pulse expanding outward from dome edge */}
              <div
                style={{
                  position: 'absolute',
                  left: cx - r,
                  top: cy - r,
                  width: r * 2,
                  height: r * 2,
                  borderRadius: '50%',
                  border: '3px solid rgba(74,172,223,0.88)',
                  boxShadow: '0 0 16px rgba(74,172,223,0.65)',
                  animation: `aura-ring-out 700ms ease-out 80ms forwards`,
                  opacity: 0,
                }}
              />
            </div>
          )
        })}

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
        {focuses.map((f) => {
          const ds = displaySize ?? 128
          const cx = ds / 2
          const cy = ds * 0.44
          // Two rings shrink inward; burst fires near the end
          const shrinkRings = [
            { w: ds * 1.02, delay: 0,   dur: 520 },
            { w: ds * 0.76, delay: 90,  dur: 540 },
          ]
          const burstW = ds * 0.52
          return (
            <div
              key={f.id}
              data-testid="battle-focus-charge"
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
            >
              {/* Converging motes — gold particles drawn inward from surrounding ring */}
              {f.motes.map((m, i) => (
                <span
                  key={i}
                  style={{
                    position: 'absolute',
                    left: m.px,
                    top: m.py,
                    width: m.sizePx,
                    height: m.sizePx,
                    marginLeft: -m.sizePx / 2,
                    marginTop: -m.sizePx / 2,
                    borderRadius: '50%',
                    background: i % 3 === 0 ? '#fef08a' : '#facc15',
                    boxShadow: '0 0 6px rgba(250,204,21,0.9), 0 0 10px rgba(245,158,11,0.45)',
                    ['--dx' as string]: `${m.dx}px`,
                    ['--dy' as string]: `${m.dy}px`,
                    animation: `focus-orbit-in 640ms ease-in ${m.delayMs}ms forwards`,
                    opacity: 0,
                  } as React.CSSProperties}
                />
              ))}

              {/* Shrinking rings — contract inward to sprite center */}
              {shrinkRings.map((ring, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: cx,
                    top: cy,
                    width: ring.w,
                    height: ring.w,
                    border: '2.5px solid rgba(250,204,21,0.82)',
                    borderRadius: '50%',
                    boxShadow: '0 0 8px rgba(250,204,21,0.4)',
                    animation: `focus-ring-shrink ${ring.dur}ms ease-in ${ring.delay}ms forwards`,
                    opacity: 0,
                  }}
                />
              ))}

              {/* Burst ring — fires at convergence point, brief outward pulse */}
              <div
                style={{
                  position: 'absolute',
                  left: cx,
                  top: cy,
                  width: burstW,
                  height: burstW,
                  border: '3px solid rgba(253,224,71,0.95)',
                  borderRadius: '50%',
                  boxShadow: '0 0 12px rgba(250,204,21,0.65), 0 0 22px rgba(245,158,11,0.35)',
                  animation: 'focus-burst-out 220ms ease-out 620ms forwards',
                  opacity: 0,
                }}
              />
            </div>
          )
        })}

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

        {/* Ground shockwave — violet ellipse at feet for power_strike.
            wide=true expands the initial ring for power_strike's heavier impact. */}
        {shockwaves.map((s) => (
          <div
            key={s.id}
            data-testid="battle-ground-shockwave"
            style={{
              position: 'absolute',
              bottom: '6%',
              left: '50%',
              width: s.wide ? '90%' : '68%',
              height: s.wide ? '22%' : '18%',
              border: s.wide ? '4px solid rgba(139,92,246,0.95)' : '3px solid rgba(139,92,246,0.9)',
              borderRadius: '50%',
              boxShadow: s.wide
                ? '0 0 14px rgba(139,92,246,0.8), 0 0 28px rgba(109,40,217,0.5)'
                : '0 0 10px rgba(139,92,246,0.7), 0 0 20px rgba(109,40,217,0.4)',
              transform: 'translate(-50%, -50%) scale(0.1)',
              pointerEvents: 'none',
              animation: `ground-shockwave ${BATTLE_ANIM.GROUND_SHOCKWAVE_MS}ms ease-out forwards`,
            }}
          />
        ))}

        {/* Overdrive afterimage streaks — fuchsia horizontal speed-blur per hit beat */}
        {streaks.map((s) => (
          <div
            key={s.id}
            data-testid="battle-overdrive-streak"
            style={{
              position: 'absolute',
              top: `${s.yPct}%`,
              left: '50%',
              width: '65%',
              height: 3,
              borderRadius: 2,
              background: 'linear-gradient(90deg, transparent 0%, rgba(217,70,239,0.85) 22%, rgba(255,255,255,0.72) 50%, rgba(217,70,239,0.85) 78%, transparent 100%)',
              filter: 'blur(0.5px)',
              pointerEvents: 'none',
              animation: 'overdrive-streak 280ms ease-out forwards',
            }}
          />
        ))}

        {/* Regen — motes rise + concentric rings expand outward + delayed +HP */}
        {regenOrbits.map((h) => {
          const ds = displaySize ?? 128
          const cx = ds / 2
          const cy = ds * 0.44
          const rings = [
            { delay: 0,   sizePct: 0.55, dur: 700 },
            { delay: 180, sizePct: 0.70, dur: 800 },
            { delay: 380, sizePct: 0.86, dur: 900 },
          ]
          return (
            <div
              key={h.id}
              data-testid="battle-regen-orbit"
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
            >
              {/* Rising motes — float upward with horizontal scatter */}
              {h.motes.map((m, i) => (
                <span
                  key={i}
                  style={{
                    position: 'absolute',
                    left: cx,
                    top: cy,
                    width: m.sizePx,
                    height: m.sizePx,
                    marginLeft: -m.sizePx / 2,
                    marginTop: -m.sizePx / 2,
                    borderRadius: '50%',
                    background: i % 4 === 0 ? '#bbf7d0' : '#4ade80',
                    boxShadow: '0 0 6px rgba(74,222,128,0.9), 0 0 10px rgba(34,197,94,0.45)',
                    ['--fx' as string]: `${m.fxPx}px`,
                    animation: `regen-mote-rise 900ms ease-out ${m.delayMs}ms forwards`,
                    opacity: 0,
                  } as React.CSSProperties}
                />
              ))}

              {/* Expanding rings — circular ripples radiating outward */}
              {rings.map((ring, i) => {
                const w = ds * ring.sizePct
                return (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      left: cx - w / 2,
                      top: cy - w / 2,
                      width: w,
                      height: w,
                      border: '3px solid rgba(74,222,128,0.88)',
                      borderRadius: '50%',
                      boxShadow: '0 0 10px rgba(74,222,128,0.45)',
                      animation: `regen-ring-expand ${ring.dur}ms ease-out ${ring.delay}ms forwards`,
                      opacity: 0,
                    }}
                  />
                )
              })}


              {/* +HP number — anchored at sprite center, keyframe pops it in then drifts it up.
                  Stays fully visible until 78% of the animation so the player can read it. */}
              <div
                style={{
                  position: 'absolute',
                  left: cx,
                  top: cy,
                  animation: `regen-number-pop 1200ms cubic-bezier(0.2,0.8,0.3,1) ${BATTLE_ANIM.REGEN_NUMBER_DELAY_MS}ms forwards`,
                  fontWeight: 800,
                  fontSize: 24,
                  lineHeight: 1,
                  color: '#4ade80',
                  textShadow: '0 2px 5px rgba(0,0,0,0.5), 0 0 12px rgba(74,222,128,0.7)',
                  whiteSpace: 'nowrap',
                  opacity: 0,
                  pointerEvents: 'none',
                }}
              >
                +{h.value}
              </div>
            </div>
          )
        })}

        {/* Charge strike converge — pips fly from spread into sprite center */}
        {chargeSpends.map((effect) => (
          <div
            key={effect.id}
            data-testid="battle-charge-spend"
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          >
            {Array.from({ length: effect.pipCount }).map((_, i) => {
              const ds = displaySize ?? 128
              const offset = i - (effect.pipCount - 1) / 2
              const startX = ds / 2 + offset * ds * 0.13
              const startY = ds * 0.82
              const dx = ds / 2 - startX
              const dy = ds * 0.50 - startY
              return (
                <span
                  key={i}
                  style={{
                    position: 'absolute',
                    left: startX,
                    top: startY,
                    width: 9,
                    height: 9,
                    marginLeft: -4.5,
                    marginTop: -4.5,
                    borderRadius: '50%',
                    background: '#facc15',
                    boxShadow: '0 0 10px rgba(250,204,21,0.95), 0 0 18px rgba(245,158,11,0.6)',
                    ['--dx' as string]: `${dx}px`,
                    ['--dy' as string]: `${dy}px`,
                    animation: `battle-focus-converge ${BATTLE_ANIM.FOCUS_SPEND_MS}ms ease-in ${i * 22}ms forwards`,
                  } as React.CSSProperties}
                />
              )
            })}
          </div>
        ))}

{/* Radial speedlines — fire on target before hit lands */}
        {speedlines.map((s) => (
          <div
            key={s.id}
            data-testid="battle-speedlines"
            style={{ position: 'absolute', left: s.cx, top: s.cy, width: 0, height: 0, pointerEvents: 'none' }}
          >
            {s.items.map((line, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: 0,
                  height: 0,
                  transform: `rotate(${line.angle}deg) translateX(${line.innerPx}px)`,
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: line.lenPx,
                    height: line.thickPx,
                    marginTop: -line.thickPx / 2,
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,220,0.88) 25%, rgba(255,255,220,0.88) 75%, transparent)',
                    borderRadius: 99,
                    transformOrigin: '0 50%',
                    filter: 'drop-shadow(0 0 2px rgba(255,255,200,0.7))',
                    animation: `battle-speedline-in 460ms cubic-bezier(0.2,0.85,0.3,1) ${line.delayMs}ms forwards`,
                    opacity: 0,
                  }}
                />
              </div>
            ))}
          </div>
        ))}

        {/* Persistent counter stance dome — enter burst + looping pulse until hidePersistentGuard() */}
        {persistentGuardState !== 'hidden' && (() => {
          const dismissing = persistentGuardState === 'dismissing'
          const ds = displaySize ?? 128
          const cx = ds / 2
          const cy = ds * 0.44
          const r = ds * 0.46
          const hexPid = `p-hex-p-${persistentGuardKey}`
          const hexGid = `p-hex-g-${persistentGuardKey}`
          const hexMid = `p-hex-m-${persistentGuardKey}`
          const hexSvg = (opacity: number) => (
            <svg
              width="100%"
              height="100%"
              style={{ position: 'absolute', inset: 0, opacity }}
              aria-hidden="true"
            >
              <defs>
                <pattern id={hexPid} width="16" height="14" patternUnits="userSpaceOnUse">
                  <polygon
                    points="8,1 15,4.5 15,10.5 8,14 1,10.5 1,4.5"
                    fill="none"
                    stroke="rgba(74,172,223,0.9)"
                    strokeWidth="0.6"
                  />
                </pattern>
                <radialGradient id={hexGid}>
                  <stop offset="0%"   stopColor="white" stopOpacity="0" />
                  <stop offset="60%"  stopColor="white" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="white" stopOpacity="1" />
                </radialGradient>
                <mask id={hexMid}>
                  <rect width="100%" height="100%" fill={`url(#${hexGid})`} />
                </mask>
              </defs>
              <rect width="100%" height="100%" fill={`url(#${hexPid})`} mask={`url(#${hexMid})`} />
            </svg>
          )
          return (
            <div
              key={persistentGuardKey}
              data-testid="battle-persistent-guard"
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
            >
              {/* Entry flash — one-shot dome-in, fades to invisible (suppressed on dismiss) */}
              {!dismissing && (
                <div
                  style={{
                    position: 'absolute',
                    left: cx - r,
                    top: cy - r,
                    width: r * 2,
                    height: r * 2,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, transparent 55%, rgba(74,172,223,0.48) 75%, rgba(74,172,223,0.70) 88%, transparent 100%)',
                    border: '2px solid rgba(74,172,223,0.88)',
                    boxShadow: 'inset 0 0 28px rgba(74,172,223,0.48), 0 0 22px rgba(74,172,223,0.42)',
                    animation: 'shield-dome-in 900ms cubic-bezier(0.25,0.8,0.3,1) forwards',
                    overflow: 'hidden',
                  }}
                >
                  {hexSvg(0.42)}
                </div>
              )}

              {/* Entry aura ring (suppressed on dismiss) */}
              {!dismissing && (
                <div
                  style={{
                    position: 'absolute',
                    left: cx - r,
                    top: cy - r,
                    width: r * 2,
                    height: r * 2,
                    borderRadius: '50%',
                    border: '3px solid rgba(74,172,223,0.88)',
                    boxShadow: '0 0 16px rgba(74,172,223,0.65)',
                    animation: 'aura-ring-out 700ms ease-out 80ms forwards',
                    opacity: 0,
                  }}
                />
              )}

              {/* Persistent dome — breathes until dismissed, then dissolves */}
              <div
                style={{
                  position: 'absolute',
                  left: cx - r,
                  top: cy - r,
                  width: r * 2,
                  height: r * 2,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, transparent 55%, rgba(74,172,223,0.26) 75%, rgba(74,172,223,0.45) 88%, transparent 100%)',
                  border: '2px solid rgba(74,172,223,0.68)',
                  boxShadow: 'inset 0 0 20px rgba(74,172,223,0.30), 0 0 16px rgba(74,172,223,0.26)',
                  animation: dismissing
                    ? 'dome-dissolve 400ms ease-out forwards'
                    : 'persistent-dome-pulse 2.2s ease-in-out infinite',
                  overflow: 'hidden',
                }}
              >
                {hexSvg(0.30)}
                {/* Glint — diagonal highlight sweeps across the dome every ~3.5s (suppressed on dismiss) */}
                {!dismissing && <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      width: '38%',
                      background: 'linear-gradient(90deg, transparent, rgba(207,233,255,0.72), transparent)',
                      animation: 'dome-glint 3.5s ease-out 1.1s infinite',
                      opacity: 0,
                    }}
                  />
                </div>}
              </div>
            </div>
          )
        })()}

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
