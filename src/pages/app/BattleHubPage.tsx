import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { WorldMapCanvas } from '@/components/battle/WorldMapCanvas'
import { OpponentNodeSheet } from '@/components/battle/OpponentNodeSheet'
import LoadingState from '@/components/ui/LoadingState'
import { useDevMode } from '@/app/providers/DevModeContext'
import { useWorldMap } from '@/features/battle/useWorldMap'
import { useProfileSummary } from '@/features/profile/useProfileSummary'
import { getTodayInTimezone } from '@/lib/date'
import type { CreatureCondition, WorldMapOpponentNode } from '@/types/domain'

function getConditionTone(condition: CreatureCondition) {
  switch (condition) {
    case 'thriving':
      return 'text-[var(--app-success)]'
    case 'recovering':
      return 'text-[var(--app-warning)]'
    default:
      return 'text-[var(--app-brand)]'
  }
}

const HUB_BG = '#0c1a10'

const COMPANION_NODE_KEY = 'nutrimon_companion_node_id'

export default function BattleHubPage() {
  const navigate = useNavigate()
  const [selectedNode, setSelectedNode] = useState<WorldMapOpponentNode | null>(null)
  const [pendingNav, setPendingNav] = useState<{ sessionId: string; targetNode: WorldMapOpponentNode } | null>(null)
  const [isFadingOut, setIsFadingOut] = useState(false)
  const initialCompanionNodeId = useState(() => localStorage.getItem(COMPANION_NODE_KEY))[0]

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--page-bg-color', HUB_BG)
    root.style.setProperty('--page-bg-image', 'none')
    return () => {
      root.style.removeProperty('--page-bg-color')
      root.style.removeProperty('--page-bg-image')
    }
  }, [])

  const { isDevMode } = useDevMode()
  const profileQuery = useProfileSummary()
  const timezone = profileQuery.data?.timezone ?? 'UTC'
  const battleDate = getTodayInTimezone(timezone)
  const worldMapQuery = useWorldMap(battleDate, timezone)

  const companion = worldMapQuery.data?.companion ?? null
  const snapshot = worldMapQuery.data?.snapshot ?? null
  const nodes = worldMapQuery.data?.nodes ?? []

  if (profileQuery.isLoading) return <LoadingState fullScreen />

  return (
    <div
      className="app-page min-h-screen px-4 pt-0 pb-10"
      style={{ background: 'linear-gradient(165deg, #0c1a10 0%, #111c16 100%)' }}
    >
      <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between gap-3 border-b border-white/10 bg-[rgb(12_26_16/0.78)] px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-white">Battle Hub</h1>
          {isDevMode && (
            <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-300">
              Dev
            </span>
          )}
        </div>
        {companion ? (
          <button
            type="button"
            className="flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-left shadow-sm backdrop-blur-md"
            onClick={() => navigate('/app/creature')}
            aria-label="View creature readiness"
          >
            {snapshot ? (
              <>
                <span className="text-sm font-bold text-white">{snapshot.readinessScore}</span>
                <span className="text-xs capitalize text-white/55">{snapshot.readinessBand}</span>
              </>
            ) : (
              <span className="text-xs text-white/55">No battle prep</span>
            )}
            <span className={`text-xs font-semibold capitalize ${getConditionTone(companion.currentCondition)}`}>
              {companion.currentCondition}
            </span>
          </button>
        ) : null}
      </div>

      {/* World map */}
      <div
        style={{
          width: '100vw',
          marginLeft: 'calc(50% - 50vw)',
          marginRight: 'calc(50% - 50vw)',
        }}
      >
        {worldMapQuery.isLoading ? (
          <div
            className="flex items-start justify-center pt-12 text-sm text-white/55"
            style={{
              width: '100%',
              height: 'calc(100dvh - 52px)',
              backgroundImage: 'linear-gradient(180deg, rgb(14 32 20 / 0.45), rgb(8 16 12 / 0.65))',
            }}
          >
            Loading world map…
          </div>
        ) : worldMapQuery.error ? (
          <div className="app-card p-5">
            <p className="text-sm text-[var(--app-text-primary)]">World map unavailable right now.</p>
            <p className="mt-1 text-xs text-[var(--app-text-muted)]">Try refreshing the page.</p>
          </div>
        ) : nodes.length === 0 ? (
          <div className="app-card p-5">
            <p className="text-sm text-[var(--app-text-muted)]">No opponents available right now.</p>
          </div>
        ) : (
          <WorldMapCanvas
            nodes={nodes}
            companion={companion}
            onSelectNode={setSelectedNode}
            travelTarget={pendingNav?.targetNode ?? null}
            initialCompanionNodeId={initialCompanionNodeId}
            onTravelComplete={() => {
              if (!pendingNav) return
              const { sessionId } = pendingNav
              setIsFadingOut(true)
              setTimeout(() => navigate(`/app/battle/run/${sessionId}`), 350)
            }}
          />
        )}
      </div>

      {/* Opponent bottom sheet */}
      {selectedNode && (
        <OpponentNodeSheet
          node={selectedNode}
          battleDate={battleDate}
          timezone={timezone}
          snapshot={snapshot}
          onClose={() => setSelectedNode(null)}
          onBattleStart={(sessionId, targetNode) => {
            setSelectedNode(null)
            setPendingNav({ sessionId, targetNode })
          }}
        />
      )}

      {/* Fade-to-black before battle transition */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          background: '#000',
          opacity: isFadingOut ? 1 : 0,
          transition: 'opacity 0.35s ease-in',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}
