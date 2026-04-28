import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomSheet from '@/components/ui/BottomSheet'
import LoadingState from '@/components/ui/LoadingState'
import { OpponentCard } from './OpponentCard'
import { useArenaDetail } from '@/features/battle/useArenaDetail'
import { useInvalidateBattleQueries } from '@/features/battle/useInvalidateBattleQueries'
import { startBattleRun } from '@/features/creature/api'
import { getArenaTerrain } from '@/lib/sprites'
import { deriveAccentVars } from '@/lib/arenaTheme'
import type { BattleOpponent, CreatureBattleSnapshot, WorldMapOpponentNode } from '@/types/domain'

interface OpponentNodeSheetProps {
  node: WorldMapOpponentNode
  battleDate: string
  timezone: string
  snapshot: CreatureBattleSnapshot | null
  onClose: () => void
}

export function OpponentNodeSheet({
  node,
  battleDate,
  timezone,
  snapshot,
  onClose,
}: OpponentNodeSheetProps) {
  const navigate = useNavigate()
  const invalidateAll = useInvalidateBattleQueries()
  const [startingOpponentId, setStartingOpponentId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const arenaDetailQuery = useArenaDetail(node.arenaId, battleDate, timezone)
  const data = arenaDetailQuery.data
  const activeBattleRun = data?.activeBattleRun ?? null

  const opponent = data?.arenaOpponents.find((o) => o.id === node.id) ?? null

  const terrain = getArenaTerrain(node.arenaId)
  const accentVars = deriveAccentVars(terrain.accentColor)

  async function handleChallenge(opp: BattleOpponent) {
    if (activeBattleRun?.opponentId === opp.id) {
      navigate(`/app/battle/run/${activeBattleRun.id}`)
      onClose()
      return
    }

    if (!snapshot) return
    setStartingOpponentId(opp.id)
    setError(null)

    try {
      const session = await startBattleRun(snapshot.id, opp.id)
      invalidateAll()
      onClose()
      navigate(`/app/battle/run/${session.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start battle')
    } finally {
      setStartingOpponentId(null)
    }
  }

  const hasOtherActive = activeBattleRun !== null && activeBattleRun.opponentId !== node.id

  return (
    <BottomSheet
      title={node.name}
      onClose={onClose}
      titleContent={
        <div className="flex items-center gap-2" style={accentVars as React.CSSProperties}>
          {node.isArenaBoss && (
            <span className="rounded-full bg-[var(--arena-accent-soft)] px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--arena-accent)]">
              Boss
            </span>
          )}
          <span className="text-base font-semibold text-[var(--app-text-primary)]">{node.name}</span>
          <span className="text-xs text-[var(--app-text-muted)]">— {node.arenaName}</span>
        </div>
      }
      footer={
        <button
          type="button"
          className="w-full text-xs text-[var(--app-text-muted)] underline underline-offset-2"
          onClick={() => {
            onClose()
            navigate(`/app/battle/arenas/${node.arenaId}`, { state: { arenaName: node.arenaName } })
          }}
        >
          View full biome
        </button>
      }
    >
      <div className="overflow-y-auto">
        {arenaDetailQuery.isLoading ? (
          <LoadingState label="Loading opponent…" />
        ) : error ? (
          <p className="px-4 py-3 text-sm text-[var(--app-error)]">{error}</p>
        ) : opponent ? (
          <OpponentCard
            opponent={opponent}
            isActive={activeBattleRun?.opponentId === opponent.id}
            isStarting={startingOpponentId === opponent.id}
            isDisabled={!snapshot || hasOtherActive || !!startingOpponentId}
            onChallenge={handleChallenge}
          />
        ) : (
          <p className="px-4 py-3 text-sm text-[var(--app-text-muted)]">Opponent data unavailable.</p>
        )}
      </div>
    </BottomSheet>
  )
}
