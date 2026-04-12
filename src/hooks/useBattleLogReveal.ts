import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { CreatureSpriteHandle } from '@/components/ui/CreatureSprite'
import type { EffectsLayerHandle } from '@/components/ui/EffectsLayer'
import type { BattleLogEntry } from '@/types/domain'

const ENTRY_DELAY_MS = 1200

export function useBattleLogReveal(opts: {
  playerSpriteRef: RefObject<CreatureSpriteHandle | null>
  opponentSpriteRef: RefObject<CreatureSpriteHandle | null>
  playerEffectsRef: RefObject<EffectsLayerHandle | null>
  opponentEffectsRef: RefObject<EffectsLayerHandle | null>
  triggerArenaShake: () => void
}) {
  const {
    playerSpriteRef,
    opponentSpriteRef,
    playerEffectsRef,
    opponentEffectsRef,
    triggerArenaShake,
  } = opts

  const animTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const [displayedLogOverride, setDisplayedLogOverride] = useState<{
    sessionId: string
    entries: BattleLogEntry[]
  } | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  // const [showOpponentRecovery, setShowOpponentRecovery] = useState(false)

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

          if (entry.phase === 'action' && entry.damage > 0) {
            if (entry.target === 'player') {
              playerSpriteRef.current?.triggerAnimation('hurt', 500)
              playerEffectsRef.current?.showDamageNumber(entry.damage, entry.crit)
              playerEffectsRef.current?.showHitImpact()
              if (entry.crit) playerEffectsRef.current?.showCritBadge()
              triggerArenaShake()
            } else if (entry.target === 'opponent') {
              opponentSpriteRef.current?.triggerAnimation('hurt', 500)
              opponentEffectsRef.current?.showDamageNumber(entry.damage, entry.crit)
              opponentEffectsRef.current?.showHitImpact()
              if (entry.crit) opponentEffectsRef.current?.showCritBadge()
              triggerArenaShake()
            }
          }

          if (entry.targetHpAfter === 0) {
            if (entry.target === 'player') {
              playerSpriteRef.current?.triggerAnimation('faint', 1400)
            } else if (entry.target === 'opponent') {
              opponentSpriteRef.current?.triggerAnimation('faint', 1400)
              // const rt = setTimeout(() => setShowOpponentRecovery(true), 1200)
              // animTimers.current.push(rt)
            }
          }

          if (i === newEntries.length - 1) {
            setIsAnimating(false)
          }
        }, i * ENTRY_DELAY_MS)
        animTimers.current.push(t)
      })
    },
    [
      triggerArenaShake,
      playerSpriteRef,
      opponentSpriteRef,
      playerEffectsRef,
      opponentEffectsRef,
    ],
  )

  useEffect(() => {
    return () => animTimers.current.forEach(clearTimeout)
  }, [])

  return {
    displayedLogOverride,
    isAnimating,
    // showOpponentRecovery,
    revealEntries,
  }
}
