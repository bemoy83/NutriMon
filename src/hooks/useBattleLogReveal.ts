import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { CreatureSpriteHandle } from '@/components/ui/CreatureSprite'
import type { EffectsLayerHandle } from '@/components/ui/EffectsLayer'
import type { SpecialActionFlashHandle } from '@/components/ui/SpecialActionFlash'
import type { BattleLogEntry } from '@/types/domain'
import { BATTLE_ANIM } from '@/lib/battleAnimationConfig'

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
  specialFlashRef: RefObject<SpecialActionFlashHandle | null>
  playerMaxHp: number
}) {
  const {
    playerSpriteRef,
    opponentSpriteRef,
    playerEffectsRef,
    opponentEffectsRef,
    triggerArenaShake,
    specialFlashRef,
    playerMaxHp,
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

          if (entry.phase === 'action' && entry.action === 'skill' && entry.actor === 'player') {
            const skillColor = SKILL_FLASH_COLOR[entry.skillId ?? '']
            if (skillColor) specialFlashRef.current?.triggerFlash(skillColor)
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
            if (entry.actor === 'player') {
              playerSpriteRef.current?.triggerAnimation('attack', BATTLE_ANIM.LUNGE_MS, false, 'right')
            } else if (entry.actor === 'opponent') {
              opponentSpriteRef.current?.triggerAnimation('attack', BATTLE_ANIM.LUNGE_MS, false, 'left')
            }
            const impactTimer = setTimeout(() => {
              if (entry.target === 'player') {
                triggerHurt(playerSpriteRef, entry.crit)
                playerEffectsRef.current?.showDamageNumber(entry.damage, entry.crit)
                playerEffectsRef.current?.showAttackImpact(entry.crit)
                if (entry.crit) playerEffectsRef.current?.showCritBadge()
                triggerArenaShake(entry.crit)
              } else if (entry.target === 'opponent') {
                triggerHurt(opponentSpriteRef, entry.crit)
                opponentEffectsRef.current?.showDamageNumber(entry.damage, entry.crit)
                opponentEffectsRef.current?.showAttackImpact(entry.crit)
                if (entry.crit) opponentEffectsRef.current?.showCritBadge()
                triggerArenaShake(entry.crit)
              }
            }, BATTLE_ANIM.LUNGE_PEAK_MS)
            animTimers.current.push(impactTimer)
          }

          if (entry.phase === 'action' && entry.action === 'skill' && entry.skillId === 'counter_stance') {
            playerEffectsRef.current?.showDefendGuard()
          }

          if (entry.phase === 'action' && entry.action === 'skill' && entry.skillId === 'regen' && entry.targetHpAfter !== null) {
            const priorEntries = [...base, ...newEntries.slice(0, i)]
            const priorHp = priorEntries.reduceRight<number | null>((found, e) => {
              if (found !== null) return found
              return e.target === 'player' && e.targetHpAfter !== null ? e.targetHpAfter : null
            }, null) ?? playerMaxHp
            const healAmount = Math.max(0, entry.targetHpAfter - priorHp)
            if (healAmount > 0) playerEffectsRef.current?.showHealEffect(healAmount)
          }

          if (entry.phase === 'action' && entry.action === 'skill' && entry.damage > 0) {
            if (entry.actor === 'player') {
              playerSpriteRef.current?.triggerAnimation('attack', BATTLE_ANIM.LUNGE_MS, false, 'right')
            } else if (entry.actor === 'opponent') {
              opponentSpriteRef.current?.triggerAnimation('attack', BATTLE_ANIM.LUNGE_MS, false, 'left')
            }
            const impactTimer = setTimeout(() => {
              if (entry.target === 'player') {
                triggerFocusedHurtSequence(playerSpriteRef, entry.crit)
                playerEffectsRef.current?.showDamageNumber(entry.damage, entry.crit)
                playerEffectsRef.current?.showFocusedAttackImpact(entry.crit)
                if (entry.crit) playerEffectsRef.current?.showCritBadge()
                triggerArenaShake(entry.crit)
              } else if (entry.target === 'opponent') {
                triggerFocusedHurtSequence(opponentSpriteRef, entry.crit)
                opponentEffectsRef.current?.showDamageNumber(entry.damage, entry.crit)
                opponentEffectsRef.current?.showFocusedAttackImpact(entry.crit)
                if (entry.crit) opponentEffectsRef.current?.showCritBadge()
                triggerArenaShake(entry.crit)
              }
            }, BATTLE_ANIM.LUNGE_PEAK_MS)
            animTimers.current.push(impactTimer)
          }

          const playerAlreadyDead = newEntries
            .slice(0, i)
            .some(e => e.target === 'player' && e.targetHpAfter === 0)
          if (entry.action === 'counter' && entry.damage > 0 && !playerAlreadyDead) {
            triggerHurt(opponentSpriteRef, false)
            opponentEffectsRef.current?.showDamageNumber(entry.damage, false)
            opponentEffectsRef.current?.showAttackImpact(false)
            triggerArenaShake(false)
          }

          if (entry.targetHpAfter === 0) {
            if (entry.target === 'player') {
              playerSpriteRef.current?.triggerAnimation('faint', BATTLE_ANIM.FAINT_MS)
            } else if (entry.target === 'opponent') {
              opponentSpriteRef.current?.triggerAnimation('faint', BATTLE_ANIM.FAINT_MS)
            }
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
