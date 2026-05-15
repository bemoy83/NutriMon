import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { CreatureSpriteHandle } from '@/components/ui/CreatureSprite'
import type { EffectsLayerHandle } from '@/components/ui/EffectsLayer'
import type { SpecialActionFlashHandle } from '@/components/ui/SpecialActionFlash'
import type { BattleLogEntry } from '@/types/domain'
import { BATTLE_ANIM } from '@/lib/battleAnimationConfig'
import { BATTLE_SKILL_PIP_COST } from '@/components/battle/battleActionConfig'

// Colors must be rgba with low alpha — the flash is a full-viewport overlay.
const SKILL_FLASH_COLOR: Record<string, string> = {
  triple_hit:    'rgba(251,146,60,0.22)',   // amber
  power_strike:  'rgba(139,92,246,0.28)',   // violet
  regen:         'rgba(34,197,94,0.22)',    // emerald
  charge_strike: 'rgba(250,204,21,0.28)',   // gold
  counter_stance:'rgba(14,165,233,0.22)',   // sky
  overdrive:     'rgba(217,70,239,0.30)',   // fuchsia
}

export function useBattleLogReveal(opts: {
  playerSpriteRef: RefObject<CreatureSpriteHandle | null>
  opponentSpriteRef: RefObject<CreatureSpriteHandle | null>
  playerEffectsRef: RefObject<EffectsLayerHandle | null>
  opponentEffectsRef: RefObject<EffectsLayerHandle | null>
  triggerArenaShake: (heavy?: boolean) => void
  triggerArenaFlash: () => void
  specialFlashRef: RefObject<SpecialActionFlashHandle | null>
  playerMaxHp: number
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
    (spriteRef: RefObject<CreatureSpriteHandle | null>, isCrit: boolean) => {
      spriteRef.current?.triggerAnimation(
        'hurt',
        isCrit ? BATTLE_ANIM.HURT_CRIT_MS : BATTLE_ANIM.HURT_MS,
        isCrit,
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
    ) => {
      for (let hit = 0; hit < hitCount; hit += 1) {
        const delayMs = hit * spacingMs
        if (delayMs === 0) {
          spriteRef.current?.triggerAnimation('hurt', BATTLE_ANIM.HIT_IMPACT_MS, isCrit)
          continue
        }
        const t = setTimeout(() => {
          spriteRef.current?.triggerAnimation('hurt', BATTLE_ANIM.HIT_IMPACT_MS, isCrit)
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
    (target: BattleLogEntry['target']) => {
      if (target === 'player') {
        playerSpriteRef.current?.triggerAnimation('faint', BATTLE_ANIM.FAINT_MS)
      } else if (target === 'opponent') {
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

      let cumulativeMs = 0
      newEntries.forEach((entry, i) => {
        const entryMs = cumulativeMs
        if (entry.phase === 'initiative') {
          cumulativeMs += BATTLE_ANIM.ENTRY_DELAY_INITIATIVE_MS
        } else if (entry.phase === 'result') {
          cumulativeMs += BATTLE_ANIM.ENTRY_DELAY_RESULT_MS
        } else if (entry.damage > 0) {
          cumulativeMs += BATTLE_ANIM.ENTRY_DELAY_ACTION_HIT_MS
        } else {
          cumulativeMs += BATTLE_ANIM.ENTRY_DELAY_ACTION_MS
        }

        const t = setTimeout(() => {
          setDisplayedLogOverride({
            sessionId,
            entries: [...base, ...newEntries.slice(0, i + 1)],
          })

          if (entry.action === 'special') {
            specialFlashRef.current?.triggerFlash()
          }

          if (entry.phase === 'action' && entry.action === 'skill' && entry.actor === 'player' && entry.damage > 0) {
            const skillColor = SKILL_FLASH_COLOR[entry.skillId ?? '']
            if (skillColor) specialFlashRef.current?.triggerFlash(skillColor)
          }

          const actorEffects =
            entry.actor === 'player'
              ? playerEffectsRef.current
              : entry.actor === 'opponent'
                ? opponentEffectsRef.current
                : null

          function scheduleAnimation(fn: () => void, delayMs: number) {
            const timer = setTimeout(fn, delayMs)
            animTimers.current.push(timer)
          }

          function resolveEntryAfter(delayMs: number) {
            scheduleAnimation(() => {
              setResolvedLogOverride({
                sessionId,
                entries: [...base, ...newEntries.slice(0, i + 1)],
              })
            }, delayMs)
          }

          if (entry.phase === 'initiative' || entry.phase === 'result') {
            setResolvedLogOverride({
              sessionId,
              entries: [...base, ...newEntries.slice(0, i + 1)],
            })
          }

          if (entry.phase === 'action' && entry.action === 'defend') {
            triggerActorAnticipation(entry.actor, BATTLE_ANIM.SUPPORT_ANTICIPATION_MS)
            resolveEntryAfter(BATTLE_ANIM.SUPPORT_ANTICIPATION_MS)
            scheduleAnimation(() => actorEffects?.showDefendGuard(), BATTLE_ANIM.SUPPORT_ANTICIPATION_MS)
          }

          if (entry.phase === 'action' && entry.action === 'focus') {
            triggerActorAnticipation(entry.actor, BATTLE_ANIM.SUPPORT_ANTICIPATION_MS)
            resolveEntryAfter(BATTLE_ANIM.SUPPORT_ANTICIPATION_MS)
            scheduleAnimation(() => actorEffects?.showFocusCharge(), BATTLE_ANIM.SUPPORT_ANTICIPATION_MS)
          }

          if (entry.phase === 'action' && entry.action === 'attack' && entry.damage > 0) {
            const targetWillFaint = entry.targetHpAfter === 0
            const contactMs = BATTLE_ANIM.ATTACK_ANTICIPATION_MS + BATTLE_ANIM.LUNGE_PEAK_MS
            triggerActorAnticipation(entry.actor, BATTLE_ANIM.ATTACK_ANTICIPATION_MS)
            scheduleAnimation(() => {
              if (entry.actor === 'player') {
                playerSpriteRef.current?.triggerAnimation('attack', BATTLE_ANIM.LUNGE_MS, false, 'right')
              } else if (entry.actor === 'opponent') {
                opponentSpriteRef.current?.triggerAnimation('attack', BATTLE_ANIM.LUNGE_MS, false, 'left')
              }
            }, BATTLE_ANIM.ATTACK_ANTICIPATION_MS)
            resolveEntryAfter(contactMs)
            const impactTimer = setTimeout(() => {
              if (entry.target === 'player') {
                triggerHurt(playerSpriteRef, entry.crit)
                playerEffectsRef.current?.showDamageNumber(entry.damage, entry.crit)
                playerEffectsRef.current?.showAttackImpact(entry.crit)
                if (entry.crit) playerEffectsRef.current?.showCritBadge()
                triggerArenaShake(entry.crit)
                triggerArenaFlash()
              } else if (entry.target === 'opponent') {
                triggerHurt(opponentSpriteRef, entry.crit)
                opponentEffectsRef.current?.showDamageNumber(entry.damage, entry.crit)
                opponentEffectsRef.current?.showAttackImpact(entry.crit)
                if (entry.crit) opponentEffectsRef.current?.showCritBadge()
                triggerArenaShake(entry.crit)
                triggerArenaFlash()
              }
              if (targetWillFaint) {
                const faintTimer = setTimeout(
                  () => triggerFaint(entry.target),
                  entry.crit ? BATTLE_ANIM.HURT_CRIT_MS : BATTLE_ANIM.HURT_MS,
                )
                animTimers.current.push(faintTimer)
              }
            }, contactMs)
            animTimers.current.push(impactTimer)
          }

          if (entry.phase === 'action' && entry.action === 'skill' && entry.skillId === 'counter_stance') {
            triggerActorAnticipation(entry.actor, BATTLE_ANIM.SUPPORT_ANTICIPATION_MS)
            actorEffects?.showFocusSpend(BATTLE_SKILL_PIP_COST.counter_stance)
            resolveEntryAfter(BATTLE_ANIM.SUPPORT_ANTICIPATION_MS)
            scheduleAnimation(
              () => playerEffectsRef.current?.showDefendGuard(BATTLE_ANIM.COUNTER_STANCE_GUARD_MS),
              BATTLE_ANIM.SUPPORT_ANTICIPATION_MS,
            )
          }

          if (entry.phase === 'action' && entry.action === 'skill' && entry.skillId === 'regen' && entry.targetHpAfter !== null) {
            const targetHpAfter = entry.targetHpAfter
            triggerActorAnticipation(entry.actor, BATTLE_ANIM.SUPPORT_ANTICIPATION_MS)
            actorEffects?.showFocusSpend(BATTLE_SKILL_PIP_COST.regen)
            resolveEntryAfter(BATTLE_ANIM.SUPPORT_ANTICIPATION_MS)
            scheduleAnimation(() => {
              const priorEntries = [...base, ...newEntries.slice(0, i)]
              const priorHp = priorEntries.reduceRight<number | null>((found, e) => {
                if (found !== null) return found
                return e.target === 'player' && e.targetHpAfter !== null ? e.targetHpAfter : null
              }, null) ?? playerMaxHp
              const healAmount = Math.max(0, targetHpAfter - priorHp)
              if (healAmount > 0) playerEffectsRef.current?.showHealEffect(healAmount)
            }, BATTLE_ANIM.SUPPORT_ANTICIPATION_MS)
          }

          if (entry.phase === 'action' && entry.action === 'skill' && entry.damage > 0) {
            const targetWillFaint = entry.targetHpAfter === 0
            const isPowerStrike = entry.skillId === 'power_strike'
            const isChargeStrike = entry.skillId === 'charge_strike'
            const isOverdrive = entry.skillId === 'overdrive'
            const isSingleHit = isPowerStrike || isChargeStrike
            const hitCount = isOverdrive ? 5 : 3
            const hitSpacingMs = isOverdrive
              ? BATTLE_ANIM.OVERDRIVE_HIT_SPACING_MS
              : BATTLE_ANIM.FOCUSED_HIT_SPACING_MS
            const anticipationMs = isSingleHit
              ? BATTLE_ANIM.HEAVY_SKILL_ANTICIPATION_MS
              : BATTLE_ANIM.ATTACK_ANTICIPATION_MS
            const contactMs = anticipationMs + BATTLE_ANIM.LUNGE_PEAK_MS
            const spentPips = entry.skillId === 'charge_strike'
              ? 4
              : BATTLE_SKILL_PIP_COST[entry.skillId ?? ''] ?? 1
            if (isChargeStrike) {
              const actorSpriteRef = entry.actor === 'player' ? playerSpriteRef : opponentSpriteRef
              actorSpriteRef.current?.triggerChargeGlow()
            }

            const doLungeAndImpact = () => {
              triggerActorAnticipation(entry.actor, anticipationMs, isSingleHit)
              actorEffects?.showFocusSpend(spentPips)
              scheduleAnimation(() => {
                if (entry.actor === 'player') {
                  playerSpriteRef.current?.triggerAnimation('attack', BATTLE_ANIM.LUNGE_MS, false, 'right')
                } else if (entry.actor === 'opponent') {
                  opponentSpriteRef.current?.triggerAnimation('attack', BATTLE_ANIM.LUNGE_MS, false, 'left')
                }
              }, anticipationMs)
              resolveEntryAfter(contactMs)
              const impactTimer = setTimeout(() => {
                if (entry.target === 'player') {
                  if (isSingleHit) {
                    triggerHurt(playerSpriteRef, entry.crit)
                    playerEffectsRef.current?.showHeavyAttackImpact(entry.crit)
                    playerEffectsRef.current?.showGroundShockwave()
                  } else {
                    triggerFocusedHurtSequence(playerSpriteRef, entry.crit, hitCount, hitSpacingMs)
                    playerEffectsRef.current?.showFocusedAttackImpact(entry.crit, hitCount, hitSpacingMs)
                  }
                  playerEffectsRef.current?.showDamageNumber(entry.damage, entry.crit)
                  if (entry.crit) playerEffectsRef.current?.showCritBadge()
                  triggerArenaShake(entry.crit)
                  triggerArenaFlash()
                } else if (entry.target === 'opponent') {
                  if (isSingleHit) {
                    triggerHurt(opponentSpriteRef, entry.crit)
                    opponentEffectsRef.current?.showHeavyAttackImpact(entry.crit)
                    opponentEffectsRef.current?.showGroundShockwave()
                  } else {
                    triggerFocusedHurtSequence(opponentSpriteRef, entry.crit, hitCount, hitSpacingMs)
                    opponentEffectsRef.current?.showFocusedAttackImpact(entry.crit, hitCount, hitSpacingMs)
                  }
                  opponentEffectsRef.current?.showDamageNumber(entry.damage, entry.crit)
                  if (entry.crit) opponentEffectsRef.current?.showCritBadge()
                  triggerArenaShake(entry.crit)
                  triggerArenaFlash()
                }
                if (targetWillFaint) {
                  const faintDelay = isSingleHit
                    ? (entry.crit ? BATTLE_ANIM.HURT_CRIT_MS : BATTLE_ANIM.HURT_MS)
                    : (hitSpacingMs * (hitCount - 1)) + BATTLE_ANIM.HIT_IMPACT_MS
                  const faintTimer = setTimeout(() => triggerFaint(entry.target), faintDelay)
                  animTimers.current.push(faintTimer)
                }
              }, contactMs)
              animTimers.current.push(impactTimer)
            }

            if (isChargeStrike) {
              const lungeTimer = setTimeout(doLungeAndImpact, BATTLE_ANIM.CHARGE_GLOW_MS)
              animTimers.current.push(lungeTimer)
            } else {
              doLungeAndImpact()
            }
          }

          const playerAlreadyDead = newEntries
            .slice(0, i)
            .some(e => e.target === 'player' && e.targetHpAfter === 0)
          if (entry.action === 'counter' && entry.damage > 0 && !playerAlreadyDead) {
            setResolvedLogOverride({
              sessionId,
              entries: [...base, ...newEntries.slice(0, i + 1)],
            })
            triggerHurt(opponentSpriteRef, false)
            opponentEffectsRef.current?.showDamageNumber(entry.damage, false)
            opponentEffectsRef.current?.showAttackImpact(false)
            triggerArenaShake(false)
            triggerArenaFlash()
            if (entry.targetHpAfter === 0) {
              const faintTimer = setTimeout(() => triggerFaint(entry.target), BATTLE_ANIM.HURT_MS)
              animTimers.current.push(faintTimer)
            }
          }

          const faintHandledByDamageSequence =
            entry.damage > 0 &&
            (
              (entry.phase === 'action' && (entry.action === 'attack' || entry.action === 'skill')) ||
              (entry.action === 'counter' && !playerAlreadyDead)
            )
          if (entry.targetHpAfter === 0 && !faintHandledByDamageSequence) {
            setResolvedLogOverride({
              sessionId,
              entries: [...base, ...newEntries.slice(0, i + 1)],
            })
            triggerFaint(entry.target)
          }

          if (i === newEntries.length - 1) {
            const lingerMs =
              entry.phase === 'initiative' ? BATTLE_ANIM.ENTRY_DELAY_INITIATIVE_MS
              : entry.phase === 'result'   ? BATTLE_ANIM.ENTRY_DELAY_RESULT_MS
              : entry.damage > 0           ? BATTLE_ANIM.ENTRY_DELAY_ACTION_HIT_MS
              :                              BATTLE_ANIM.ENTRY_DELAY_ACTION_MS
            const finishTimer = setTimeout(() => setIsAnimating(false), lingerMs)
            animTimers.current.push(finishTimer)
          }
        }, entryMs)
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
