import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { CreatureSpriteHandle } from '@/components/ui/CreatureSprite'
import type { EffectsLayerHandle } from '@/components/ui/EffectsLayer'
import type { SpecialActionFlashHandle } from '@/components/ui/SpecialActionFlash'
import type { BattleLogEntry } from '@/types/domain'
import { BATTLE_ANIM } from '@/lib/battleAnimationConfig'
import {
  makeSkillPipSpendResolvedEntry,
  planBattleAnimationEvents,
  type BattleAnimationEvent,
  type BattleAnimationTarget,
} from './battleAnimationPlan'

type BasicImpactTint = Extract<
  BattleAnimationEvent,
  { type: 'effect'; kind: 'basic_impact' }
>['tint']

export function useBattleLogReveal(opts: {
  playerSpriteRef: RefObject<CreatureSpriteHandle | null>
  opponentSpriteRef: RefObject<CreatureSpriteHandle | null>
  playerEffectsRef: RefObject<EffectsLayerHandle | null>
  opponentEffectsRef: RefObject<EffectsLayerHandle | null>
  triggerArenaShake: (heavy?: boolean) => void
  triggerArenaFlash: () => void
  specialFlashRef: RefObject<SpecialActionFlashHandle | null>
  playerMaxHp: number
  playerPipCap: number
  playerFocusGain: number
}) {
  const {
    playerSpriteRef,
    opponentSpriteRef,
    playerEffectsRef,
    opponentEffectsRef,
    triggerArenaShake,
    triggerArenaFlash,
    specialFlashRef,
    playerMaxHp,
    playerPipCap,
    playerFocusGain,
  } = opts

  const animTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const [displayedLogOverride, setDisplayedLogOverride] = useState<{
    sessionId: string
    entries: BattleLogEntry[]
  } | null>(null)
  const [resolvedLogOverride, setResolvedLogOverride] = useState<{
    sessionId: string
    entries: BattleLogEntry[]
  } | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)

  const triggerHurt = useCallback(
    (spriteRef: RefObject<CreatureSpriteHandle | null>, isCrit: boolean, recoilDir?: 'right' | 'left') => {
      spriteRef.current?.triggerAnimation(
        'hurt',
        isCrit ? BATTLE_ANIM.HURT_CRIT_MS : BATTLE_ANIM.HURT_MS,
        isCrit,
        recoilDir,
      )
    },
    [],
  )

  const triggerFocusedHurtSequence = useCallback(
    (
      spriteRef: RefObject<CreatureSpriteHandle | null>,
      isCrit: boolean,
      hitCount = 3,
      spacingMs: number = BATTLE_ANIM.FOCUSED_HIT_SPACING_MS,
      recoilDir?: 'right' | 'left',
      finalHitDurationMs: number = BATTLE_ANIM.HIT_IMPACT_MS,
    ) => {
      for (let hit = 0; hit < hitCount; hit += 1) {
        const delayMs = hit * spacingMs
        const durationMs = hit === hitCount - 1 ? finalHitDurationMs : BATTLE_ANIM.HIT_IMPACT_MS
        if (delayMs === 0) {
          spriteRef.current?.triggerAnimation('hurt', durationMs, isCrit, recoilDir)
          continue
        }
        const t = setTimeout(() => {
          spriteRef.current?.triggerAnimation('hurt', durationMs, isCrit, recoilDir)
        }, delayMs)
        animTimers.current.push(t)
      }
    },
    [],
  )

  const triggerActorAnticipation = useCallback(
    (actor: BattleLogEntry['actor'], durationMs: number, heavy = false) => {
      if (actor === 'player') {
        playerSpriteRef.current?.triggerAnticipation('right', durationMs, heavy)
      } else if (actor === 'opponent') {
        opponentSpriteRef.current?.triggerAnticipation('left', durationMs, heavy)
      }
    },
    [opponentSpriteRef, playerSpriteRef],
  )

  const triggerFaint = useCallback(
    (target: BattleAnimationTarget) => {
      if (target === 'player') {
        playerSpriteRef.current?.triggerAnimation('faint', BATTLE_ANIM.FAINT_MS)
      } else {
        opponentSpriteRef.current?.triggerAnimation('faint', BATTLE_ANIM.FAINT_MS)
      }
    },
    [opponentSpriteRef, playerSpriteRef],
  )

  const revealEntries = useCallback(
    (sessionId: string, fullLog: BattleLogEntry[], base: BattleLogEntry[]) => {
      animTimers.current.forEach(clearTimeout)
      animTimers.current = []

      const newEntries = fullLog.slice(base.length)
      setDisplayedLogOverride({ sessionId, entries: base })
      setResolvedLogOverride({ sessionId, entries: base })

      if (newEntries.length === 0) return

      setIsAnimating(true)

      const executeEvent = (event: BattleAnimationEvent) => {
        const targetSprite = (target: BattleAnimationTarget) =>
          target === 'player' ? playerSpriteRef : opponentSpriteRef

        if (event.type === 'reveal_log_entry') {
          setDisplayedLogOverride({
            sessionId,
            entries: [...base, ...newEntries.slice(0, event.entryIndex + 1)],
          })
          return
        }

        if (event.type === 'resolve_log_entry') {
          if (event.mode === 'pip_spend_only') {
            const entry = newEntries[event.entryIndex]
            setResolvedLogOverride({
              sessionId,
              entries: [
                ...base,
                ...newEntries.slice(0, event.entryIndex),
                makeSkillPipSpendResolvedEntry(entry),
              ],
            })
          } else {
            setResolvedLogOverride({
              sessionId,
              entries: [...base, ...newEntries.slice(0, event.entryIndex + 1)],
            })
          }
          return
        }

        if (event.type === 'sprite_anticipation') {
          triggerActorAnticipation(event.actor, event.durationMs, event.heavy)
          return
        }

        if (event.type === 'sprite_attack') {
          if (event.actor === 'player') {
            playerSpriteRef.current?.triggerAnimation('attack', BATTLE_ANIM.LUNGE_MS, false, 'right')
          } else {
            opponentSpriteRef.current?.triggerAnimation('attack', BATTLE_ANIM.LUNGE_MS, false, 'left')
          }
          return
        }

        if (event.type === 'sprite_hurt') {
          // Player is on the left, so player recoils left (away from right-side opponent).
          // Opponent is on the right, so opponent recoils right (away from left-side player).
          const recoilDir = event.target === 'player' ? 'left' : 'right'
          if (event.hitCount) {
            triggerFocusedHurtSequence(
              targetSprite(event.target),
              event.crit,
              event.hitCount,
              event.spacingMs,
              recoilDir,
              event.finalHitDurationMs,
            )
          } else {
            triggerHurt(targetSprite(event.target), event.crit, recoilDir)
          }
          return
        }

        if (event.type === 'sprite_faint') {
          triggerFaint(event.target)
          return
        }

        if (event.type === 'effect') {
          const fx = (target: BattleAnimationTarget) =>
            target === 'player' ? playerEffectsRef.current : opponentEffectsRef.current
          const showAttackImpact = (
            target: BattleAnimationTarget,
            crit: boolean,
            tint?: BasicImpactTint,
          ) => {
            if (tint) {
              fx(target)?.showAttackImpact(crit, tint)
            } else {
              fx(target)?.showAttackImpact(crit)
            }
          }
          const showHeavyAttackImpact = (
            target: BattleAnimationTarget,
            crit: boolean,
            tint?: BasicImpactTint,
          ) => {
            if (tint) {
              fx(target)?.showHeavyAttackImpact(crit, tint)
            } else {
              fx(target)?.showHeavyAttackImpact(crit)
            }
          }
          switch (event.kind) {
            case 'defend_guard':
              fx(event.target)?.showDefendGuard()
              break
            case 'guard_impact':
              fx(event.target)?.showGuardImpact(event.intensity)
              break
            case 'focus_charge':
              fx(event.target)?.showFocusCharge()
              targetSprite(event.target).current?.triggerFocusGlow()
              break
            case 'persistent_guard':
              playerEffectsRef.current?.showPersistentGuard()
              break
            case 'hide_persistent_guard':
              playerEffectsRef.current?.hidePersistentGuard()
              break
            case 'charge_glow':
              targetSprite(event.target).current?.triggerChargeGlow()
              break
            case 'regen':
              if (event.healAmount > 0) playerEffectsRef.current?.showRegenOrbitEffect(event.healAmount)
              playerSpriteRef.current?.triggerHealGlow()
              break
            case 'flash':
              specialFlashRef.current?.triggerFlash(event.color)
              break
            case 'basic_impact':
              if (event.heavy) {
                showHeavyAttackImpact(event.target, event.crit, event.tint)
              } else {
                showAttackImpact(event.target, event.crit, event.tint)
              }
              fx(event.target)?.showDamageNumber(event.damage, event.crit)
              break
            case 'focused_impact': {
              fx(event.target)?.showFocusedAttackImpact(
                event.crit,
                event.hitCount,
                event.spacingMs,
                event.impactVariant,
                event.tint,
                { emphasizeFinalHit: true },
              )
              if (event.hitBreakdown && event.hitBreakdown.length > 0) {
                // Per-hit numbers: one float-up at each hit beat timing.
                event.hitBreakdown.forEach((hit, i) => {
                  const delayMs = i * event.spacingMs
                  const fire = () => fx(event.target)?.showDamageNumber(hit.damage, hit.crit)
                  if (delayMs === 0) {
                    fire()
                  } else {
                    const t = setTimeout(fire, delayMs)
                    animTimers.current.push(t)
                  }
                })
              } else {
                // Fallback for log entries predating hit_breakdown: one total at the end.
                const showDamage = () => fx(event.target)?.showDamageNumber(event.damage, event.crit)
                if (event.damageDelayMs > 0) {
                  const t = setTimeout(showDamage, event.damageDelayMs)
                  animTimers.current.push(t)
                } else {
                  showDamage()
                }
              }
              break
            }
            case 'overdrive_streak':
              fx(event.target)?.showOverdriveStreak(event.streakColor)
              break
            case 'ground_shockwave':
              fx(event.target)?.showGroundShockwave(event.wide, event.color)
              break
            case 'spark_burst':
              fx(event.target)?.showSparkBurst(event.color)
              break
            case 'counter_impact':
              fx(event.target)?.showDamageNumber(event.damage, false)
              fx(event.target)?.showAttackImpact(false, event.tint)
              break
          }
          return
        }

        if (event.type === 'arena_shake') {
          triggerArenaShake(event.heavy)
          return
        }

        if (event.type === 'arena_flash') {
          triggerArenaFlash()
          return
        }

        if (event.type === 'finish_animation') {
          setIsAnimating(false)
          playerEffectsRef.current?.hidePersistentGuard()
        }
      }

      const plan = planBattleAnimationEvents({
        base,
        newEntries,
        playerMaxHp,
        playerPipCap,
        playerFocusGain,
      })

      plan.forEach(({ atMs, event }) => {
        const t = setTimeout(() => executeEvent(event), atMs)
        animTimers.current.push(t)
      })
    },
    [
      triggerArenaShake,
      triggerArenaFlash,
      triggerHurt,
      triggerFocusedHurtSequence,
      triggerActorAnticipation,
      triggerFaint,
      playerSpriteRef,
      opponentSpriteRef,
      playerEffectsRef,
      opponentEffectsRef,
      specialFlashRef,
      playerMaxHp,
      playerPipCap,
      playerFocusGain,
    ],
  )

  useEffect(() => {
    return () => animTimers.current.forEach(clearTimeout)
  }, [])

  return {
    displayedLogOverride,
    resolvedLogOverride,
    isAnimating,
    revealEntries,
  }
}
