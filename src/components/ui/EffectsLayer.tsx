import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { BATTLE_ANIM } from '@/lib/battleAnimationConfig'
import type { ImpactVariant } from './ImpactGraphic'
import { DamageNumberEffects, type CritBadge, type FloatingNumber } from './battle-effects/DamageNumberEffects'
import { FocusChargeEffects, type FocusEffect, type FocusMote } from './battle-effects/FocusChargeEffects'
import { GuardEffects, type GuardEffect, type PersistentGuardState } from './battle-effects/GuardEffects'
import { ImpactEffects, type HitImpact, type ImpactColor } from './battle-effects/ImpactEffects'
import { PipSpendEffects, type ChargeSpendEffect, type FocusSpendEffect } from './battle-effects/PipSpendEffects'
import { RegenEffects, type RegenMote, type RegenOrbitEffect } from './battle-effects/RegenEffects'
import { ShockwaveEffects, type OverdriveStreak, type ShockwaveEffect } from './battle-effects/ShockwaveEffects'
import { SpeedlineEffects, type SpeedlineEffect, type SpeedlineItem } from './battle-effects/SpeedlineEffects'

export interface EffectsLayerHandle {
  showDamageNumber(value: number, isCrit: boolean): void
  showCritBadge(): void
  showAttackImpact(isCrit?: boolean, impactColor?: ImpactColor): void
  showHeavyAttackImpact(isCrit?: boolean, impactColor?: ImpactColor): void
  showFocusedAttackImpact(isCrit?: boolean, hitCount?: number, spacingMs?: number, variant?: ImpactVariant, impactColor?: ImpactColor): void
  showGroundShockwave(wide?: boolean): void
  showDefendGuard(durationMs?: number): void
  showFocusCharge(): void
  showFocusSpend(pipCount: number): void
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
    const [shockwaves, setShockwaves] = useState<ShockwaveEffect[]>([])
    const [streaks, setStreaks] = useState<OverdriveStreak[]>([])
    const [regenOrbits, setRegenOrbits] = useState<RegenOrbitEffect[]>([])
    const [chargeSpends, setChargeSpends] = useState<ChargeSpendEffect[]>([])
    const [speedlines, setSpeedlines] = useState<SpeedlineEffect[]>([])
    const [persistentGuardState, setPersistentGuardState] = useState<PersistentGuardState>('hidden')
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
        const cutPattern = [
          { xPct: 44, yPct: 54, angle: -42 },
          { xPct: 55, yPct: 40, angle: 38 },
          { xPct: 50, yPct: 50, angle: -8 },
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
          addDelayedTimedEffect(setImpacts, impact, hit.delayMs, IMPACT_DURATION_MS)
        })
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
        <DamageNumberEffects numbers={numbers} crits={crits} />
        <ImpactEffects impacts={impacts} impactPx={impactPx} />
        <GuardEffects
          guards={guards}
          persistentGuardState={persistentGuardState}
          persistentGuardKey={persistentGuardKey}
          displaySize={displaySize}
        />
        <PipSpendEffects focusSpends={focusSpends} chargeSpends={chargeSpends} displaySize={displaySize} />
        <FocusChargeEffects focuses={focuses} displaySize={displaySize} />
        <ShockwaveEffects shockwaves={shockwaves} streaks={streaks} />
        <RegenEffects regenOrbits={regenOrbits} displaySize={displaySize} />
        <SpeedlineEffects speedlines={speedlines} />
      </div>
    )
  },
)

export default EffectsLayer
