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

type BattleEffectPayload = {
  count?: number
  crit?: boolean
  damage?: number
  color?: string
  healAmount?: number
  hitCount?: number
  spacingMs?: number
  groundShockwaveHeavy?: boolean
  impactVariant?: Parameters<EffectsLayerHandle['showFocusedAttackImpact']>[3]
  tint?: Parameters<EffectsLayerHandle['showAttackImpact']>[1]
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
        const targetEffects = (target: BattleAnimationTarget) =>
          target === 'player' ? playerEffectsRef.current : opponentEffectsRef.current
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
          if (event.hitCount) {
            triggerFocusedHurtSequence(targetSprite(event.target), event.crit, event.hitCount, event.spacingMs)
          } else {
            triggerHurt(targetSprite(event.target), event.crit)
          }
          return
        }

        if (event.type === 'sprite_faint') {
          triggerFaint(event.target)
          return
        }

        if (event.type === 'effect') {
          const effects = targetEffects(event.target)
          const payload = (event.payload ?? {}) as BattleEffectPayload
          const crit = Boolean(payload.crit)
          const damage = Number(payload.damage ?? 0)
          if (event.effect === 'defend_guard') effects?.showDefendGuard()
          if (event.effect === 'focus_charge') {
            effects?.showFocusCharge()
            targetSprite(event.target).current?.triggerFocusGlow()
          }
          if (event.effect === 'focus_spend') playerEffectsRef.current?.showFocusSpend(Number(payload.count ?? 0))
          if (event.effect === 'charge_strike_spend') {
            playerEffectsRef.current?.showChargeStrikeSpend(Number(payload.count ?? 0))
          }
          if (event.effect === 'persistent_guard') playerEffectsRef.current?.showPersistentGuard()
          if (event.effect === 'hide_persistent_guard') playerEffectsRef.current?.hidePersistentGuard()
          if (event.effect === 'charge_glow') targetSprite(event.target).current?.triggerChargeGlow()
          if (event.effect === 'regen') {
            const healAmount = Number(payload.healAmount ?? 0)
            if (healAmount > 0) playerEffectsRef.current?.showRegenOrbitEffect(healAmount)
            playerSpriteRef.current?.triggerHealGlow()
          }
          if (event.effect === 'special_flash') specialFlashRef.current?.triggerFlash(payload.color)
          if (event.effect === 'basic') {
            effects?.showDamageNumber(damage, crit)
            effects?.showAttackImpact(crit)
            effects?.showSpeedlines()
            if (crit) effects?.showCritBadge()
          }
          if (event.effect === 'heavy_skill') {
            effects?.showHeavyAttackImpact(crit, payload.tint)
            effects?.showGroundShockwave(Boolean(payload.groundShockwaveHeavy))
            effects?.showDamageNumber(damage, crit)
            if (crit) effects?.showCritBadge()
          }
          if (event.effect === 'focused_skill') {
            effects?.showFocusedAttackImpact(
              crit,
              Number(payload.hitCount ?? 3),
              Number(payload.spacingMs ?? BATTLE_ANIM.FOCUSED_HIT_SPACING_MS),
              payload.impactVariant,
              payload.tint,
            )
            effects?.showDamageNumber(damage, crit)
            if (crit) effects?.showCritBadge()
          }
          if (event.effect === 'overdrive_streak') effects?.showOverdriveStreak()
          if (event.effect === 'counter') {
            effects?.showDamageNumber(damage, false)
            effects?.showAttackImpact(false, payload.tint)
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
