import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { CreatureSpriteHandle } from '@/components/ui/CreatureSprite'
import type { EffectsLayerHandle } from '@/components/ui/EffectsLayer'
import type { SpecialActionFlashHandle } from '@/components/ui/SpecialActionFlash'
import type { BattleLogEntry } from '@/types/domain'
import { BATTLE_ANIM } from '@/lib/battleAnimationConfig'

export function useBattleLogReveal(opts: {
  playerSpriteRef: RefObject<CreatureSpriteHandle | null>
  opponentSpriteRef: RefObject<CreatureSpriteHandle | null>
  playerEffectsRef: RefObject<EffectsLayerHandle | null>
  opponentEffectsRef: RefObject<EffectsLayerHandle | null>
  triggerArenaShake: (heavy?: boolean) => void
  specialFlashRef: RefObject<SpecialActionFlashHandle | null>
}) {
  const {
    playerSpriteRef,
    opponentSpriteRef,
    playerEffectsRef,
    opponentEffectsRef,
    triggerArenaShake,
    specialFlashRef,
  } = opts

  const animTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const [displayedLogOverride, setDisplayedLogOverride] = useState<{
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
    (spriteRef: RefObject<CreatureSpriteHandle | null>, isCrit: boolean) => {
      for (let hit = 0; hit < 3; hit += 1) {
        const delayMs = hit * BATTLE_ANIM.FOCUSED_HIT_SPACING_MS
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

  const revealEntries = useCallback(
    (sessionId: string, fullLog: BattleLogEntry[], base: BattleLogEntry[]) => {
      animTimers.current.forEach(clearTimeout)
      animTimers.current = []

      const newEntries = fullLog.slice(base.length)
      setDisplayedLogOverride({ sessionId, entries: base })

      if (newEntries.length === 0) return

      setIsAnimating(true)

      newEntries.forEach((entry, i) => {
        const t = setTimeout(() => {
          setDisplayedLogOverride({
            sessionId,
            entries: [...base, ...newEntries.slice(0, i + 1)],
          })

          if (entry.action === 'special') {
            specialFlashRef.current?.triggerFlash()
          }

          const actorEffects =
            entry.actor === 'player'
              ? playerEffectsRef.current
              : entry.actor === 'opponent'
                ? opponentEffectsRef.current
                : null

          if (entry.phase === 'action' && entry.action === 'defend') {
            actorEffects?.showDefendGuard()
          }

          if (entry.phase === 'action' && entry.action === 'focus') {
            actorEffects?.showFocusCharge()
          }

          if (entry.phase === 'action' && entry.action === 'attack' && entry.damage > 0) {
            if (entry.target === 'player') {
              if (entry.consumedNextAttackBonus) {
                triggerFocusedHurtSequence(playerSpriteRef, entry.crit)
              } else {
                triggerHurt(playerSpriteRef, entry.crit)
              }
              playerEffectsRef.current?.showDamageNumber(entry.damage, entry.crit)
              if (entry.consumedNextAttackBonus) {
                playerEffectsRef.current?.showFocusedAttackImpact(entry.crit)
              } else {
                playerEffectsRef.current?.showAttackImpact(entry.crit)
              }
              if (entry.crit) playerEffectsRef.current?.showCritBadge()
              triggerArenaShake(entry.crit)
            } else if (entry.target === 'opponent') {
              if (entry.consumedNextAttackBonus) {
                triggerFocusedHurtSequence(opponentSpriteRef, entry.crit)
              } else {
                triggerHurt(opponentSpriteRef, entry.crit)
              }
              opponentEffectsRef.current?.showDamageNumber(entry.damage, entry.crit)
              if (entry.consumedNextAttackBonus) {
                opponentEffectsRef.current?.showFocusedAttackImpact(entry.crit)
              } else {
                opponentEffectsRef.current?.showAttackImpact(entry.crit)
              }
              if (entry.crit) opponentEffectsRef.current?.showCritBadge()
              triggerArenaShake(entry.crit)
            }
          }

          if (entry.targetHpAfter === 0) {
            if (entry.target === 'player') {
              playerSpriteRef.current?.triggerAnimation('faint', BATTLE_ANIM.FAINT_MS)
            } else if (entry.target === 'opponent') {
              opponentSpriteRef.current?.triggerAnimation('faint', BATTLE_ANIM.FAINT_MS)
            }
          }

          if (i === newEntries.length - 1) {
            setIsAnimating(false)
          }
        }, i * BATTLE_ANIM.ENTRY_DELAY_MS)
        animTimers.current.push(t)
      })
    },
    [
      triggerArenaShake,
      triggerHurt,
      triggerFocusedHurtSequence,
      playerSpriteRef,
      opponentSpriteRef,
      playerEffectsRef,
      opponentEffectsRef,
      specialFlashRef,
    ],
  )

  useEffect(() => {
    return () => animTimers.current.forEach(clearTimeout)
  }, [])

  return {
    displayedLogOverride,
    isAnimating,
    revealEntries,
  }
}
