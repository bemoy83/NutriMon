import { useCallback, useRef, useState, type CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArenaPlatformImage } from '@/components/battle/ArenaPlatformImage'
import {
  type BattleActionLabel,
  battleActionToPayload,
} from '@/components/battle/battleActionConfig'
import { BattleCommandBar } from '@/components/battle/BattleCommandBar'
import { BattleHudCard, BattleHudHpBar } from '@/components/battle/BattleHudCard'
import { battleArenaCmdBarVars, battleGameplayBandClass } from '@/components/battle/battleLayout'
import { BattleOutcomeModal } from '@/components/battle/BattleOutcomeModal'
import LoadingState from '@/components/ui/LoadingState'
import CreatureSprite from '@/components/ui/CreatureSprite'
import type { CreatureSpriteHandle } from '@/components/ui/CreatureSprite'
import SpriteStage from '@/components/ui/SpriteStage'
import EffectsLayer from '@/components/ui/EffectsLayer'
import type { EffectsLayerHandle } from '@/components/ui/EffectsLayer'
import { useBattleRun, useSubmitBattleAction } from '@/features/creature/useBattleRun'
import { useBattleLogReveal } from '@/hooks/useBattleLogReveal'
import { useTerrainBackground } from '@/hooks/useTerrainBackground'
import {
  computePlayerPlatformStyle,
  getArenaTerrain,
  getCoLocatedPlatformStyle,
  getHitImpactUrl,
  getOpponentFootOffsetX,
  getOpponentSpriteDescriptor,
  getPlayerBattleSpriteDescriptor,
} from '@/lib/sprites'

// Player display size scales with companion stage (closer perspective = larger).
const PLAYER_DISPLAY_SIZE: Record<string, number> = {
  baby: 192,
  adult: 240,
  champion: 288,
}
function getPlayerSize(stage: string): number {
  return PLAYER_DISPLAY_SIZE[stage] ?? PLAYER_DISPLAY_SIZE.baby
}

// Opponent display size is driven by the opponent's size_class (creature type),
// not by the player's stage — a Colossus is always large regardless of who fights it.
const OPPONENT_SIZE_BY_CLASS: Record<string, number> = {
  small: 96,
  medium: 144,
  large: 192,
}
// Platform art is calibrated for the medium size. Scale proportionally for other sizes.
const OPPONENT_PLATFORM_BASELINE = OPPONENT_SIZE_BY_CLASS.medium

function getOpponentSize(sizeClass: string): number {
  return OPPONENT_SIZE_BY_CLASS[sizeClass] ?? OPPONENT_SIZE_BY_CLASS.medium
}

function scaleOpponentPlatformWidth(registeredWidth: number, displaySize: number): number {
  return Math.round(registeredWidth * (displaySize / OPPONENT_PLATFORM_BASELINE))
}

export default function BattlePage() {
  const { battleRunId } = useParams<{ battleRunId: string }>()
  const navigate = useNavigate()

  const arenaRef = useRef<HTMLDivElement>(null)
  const playerSpriteRef = useRef<CreatureSpriteHandle>(null)
  const opponentSpriteRef = useRef<CreatureSpriteHandle>(null)
  const playerEffectsRef = useRef<EffectsLayerHandle>(null)
  const opponentEffectsRef = useRef<EffectsLayerHandle>(null)

  const { data: session, isLoading, error } = useBattleRun(battleRunId)
  const { mutate: submitAction, isPending } = useSubmitBattleAction()

  const terrainPlatformUrl = session ? getArenaTerrain(session.opponent.arenaId).playerPlatformUrl : null
  const arenaBackground = useTerrainBackground(terrainPlatformUrl)

  const triggerArenaShake = useCallback((heavy = false) => {
    const el = arenaRef.current
    if (!el) return
    const cls = heavy ? 'animate-shake-heavy' : 'animate-shake'
    el.classList.remove('animate-shake', 'animate-shake-heavy')
    void el.offsetWidth
    el.classList.add(cls)
    setTimeout(() => el.classList.remove(cls), heavy ? 500 : 400)
  }, [])

  const { displayedLogOverride, isAnimating, revealEntries } = useBattleLogReveal({
    playerSpriteRef,
    opponentSpriteRef,
    playerEffectsRef,
    opponentEffectsRef,
    triggerArenaShake,
  })

  const [pendingAction, setPendingAction] = useState<BattleActionLabel | null>(null)

  const displayedLog =
    session && displayedLogOverride?.sessionId === session.id
      ? isAnimating || displayedLogOverride.entries.length > session.battleLog.length
        ? displayedLogOverride.entries
        : session.battleLog
      : session?.battleLog ?? []

  if (isLoading) return <LoadingState fullScreen />

  if (error || !session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--app-bg)] px-6">
        <p className="text-center text-sm text-[var(--app-text-secondary)]">
          {error instanceof Error ? error.message : 'Unable to load battle.'}
        </p>
        <button
          type="button"
          onClick={() => navigate('/app/battle')}
          className="rounded-xl bg-[var(--app-brand)] px-5 py-3 text-sm font-semibold text-white"
        >
          Return to Hub
        </button>
      </div>
    )
  }

  const terrain = getArenaTerrain(session.opponent.arenaId)
  const hitImpactUrl = getHitImpactUrl()
  const playerDisplaySize = getPlayerSize(session.companion.stage)
  const opponentDisplaySize = getOpponentSize(session.opponent.sizeClass)

  let opponentHp = session.opponentMaxHp
  let playerHp = session.playerMaxHp
  for (const entry of displayedLog) {
    if (entry.target === 'opponent' && entry.targetHpAfter !== null) opponentHp = entry.targetHpAfter
    if (entry.target === 'player' && entry.targetHpAfter !== null) playerHp = entry.targetHpAfter
  }

  const isActive = session.status === 'active'
  const isCompleted = session.status === 'completed'
  const isWin = session.outcome === 'win'
  const allEntriesShown = displayedLog.length === session.battleLog.length
  const lastEntry = displayedLog[displayedLog.length - 1] ?? null

  const dialogue =
    lastEntry?.message ??
    (isActive ? `Round ${session.currentRound} — what will ${session.companion.name} do?` : null)

  function handleAction(label: BattleActionLabel) {
    if (!session || !isActive || isPending || isAnimating) return
    const prevLog = [...displayedLog]
    setPendingAction(label)
    submitAction(
      { battleRunId: session.id, action: battleActionToPayload[label] },
      {
        onSuccess: (updated) => {
          setPendingAction(null)
          revealEntries(updated.id, updated.battleLog, prevLog)
        },
        onError: () => {
          setPendingAction(null)
        },
      },
    )
  }

  // Player platform only — opponent platform is co-located inside the opponent sprite div.
  const platformItems: { key: string; url: string; style: CSSProperties }[] = []
  if (terrain.playerPlatformUrl && terrain.playerPlatformRenderedWidth != null) {
    platformItems.push({
      key: 'player',
      url: terrain.playerPlatformUrl,
      style: computePlayerPlatformStyle(
        terrain.playerPlatformRenderedWidth,
        playerDisplaySize,
        terrain.playerPlatformCalibration,
      ),
    })
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--app-bg)]">
      <div
        ref={arenaRef}
        className="relative flex-1 overflow-hidden"
        style={{ background: arenaBackground, ...battleArenaCmdBarVars() }}
      >
        <div className={battleGameplayBandClass}>
          {platformItems.map(({ key, url, style }) => (
            <ArenaPlatformImage key={key} src={url} imgStyle={style} />
          ))}

          <BattleHudCard
            className="left-4 max-sm:max-w-[calc(100vw-3.5rem-128px)]"
            style={{ top: 'calc(28% - 8px)' }}
          >
            <div className="flex min-w-0 items-baseline justify-between">
              <p className="truncate text-sm font-bold text-white">{session.opponent.name}</p>
              <p className="ml-2 shrink-0 text-xs text-white/60">Lv{session.opponent.recommendedLevel}</p>
            </div>
            <p className="mt-0.5 text-xs font-semibold uppercase tracking-widest text-white/60">HP</p>
            <BattleHudHpBar current={opponentHp} max={session.opponentMaxHp} variant="danger" />
          </BattleHudCard>

          {/* z-stacking (low → high): opponent platform < companion platform < opponent sprite < player sprite < HUD (z-10) */}
          <div
            className="pointer-events-none absolute top-[28%] right-6 z-[1]"
            style={{ width: opponentDisplaySize, height: opponentDisplaySize, overflow: 'visible' }}
          >
            {terrain.opponentPlatformUrl && terrain.opponentPlatformWidth && (
              <img
                src={terrain.opponentPlatformUrl}
                alt=""
                draggable={false}
                style={{
                  ...getCoLocatedPlatformStyle(
                    scaleOpponentPlatformWidth(terrain.opponentPlatformWidth, opponentDisplaySize),
                    opponentDisplaySize,
                    getOpponentFootOffsetX(session.opponent.name),
                    terrain.opponentCalibration,
                  ),
                  zIndex: 0,
                }}
              />
            )}
          </div>

          <div className="absolute top-[28%] right-6 z-[3]" style={{ overflow: 'visible' }}>
            <SpriteStage displaySize={opponentDisplaySize} contactShadow>
              <CreatureSprite
                ref={opponentSpriteRef}
                descriptor={getOpponentSpriteDescriptor(session.opponent.name)}
                displaySize={opponentDisplaySize}
                flip={false}
              />
              <EffectsLayer
                ref={opponentEffectsRef}
                hitImpactUrl={hitImpactUrl ?? undefined}
                displaySize={opponentDisplaySize}
              />
            </SpriteStage>
          </div>

          <div className="absolute bottom-4 left-6 z-[4]">
            <SpriteStage displaySize={playerDisplaySize} contactShadow>
              <CreatureSprite
                ref={playerSpriteRef}
                descriptor={getPlayerBattleSpriteDescriptor(
                  session.companion.stage,
                  session.companion.currentCondition,
                )}
                displaySize={playerDisplaySize}
                flip={false}
              />
              <EffectsLayer
                ref={playerEffectsRef}
                hitImpactUrl={hitImpactUrl ?? undefined}
                displaySize={playerDisplaySize}
              />
            </SpriteStage>
          </div>

          <BattleHudCard className="right-4 bottom-10 max-sm:max-w-[min(11rem,calc(100vw-3.5rem-128px))]">
            <div className="flex min-w-0 items-baseline justify-between">
              <p className="truncate text-sm font-bold text-white">{session.companion.name}</p>
              <p className="ml-2 shrink-0 text-xs text-white/60">Lv{session.companion.level}</p>
            </div>
            <p className="mt-0.5 text-xs font-semibold uppercase tracking-widest text-white/60">HP</p>
            <BattleHudHpBar current={playerHp} max={session.playerMaxHp} variant="brand" />
            <p className="mt-1 text-right text-xs tabular-nums text-white/70">
              {playerHp} / {session.playerMaxHp}
            </p>
          </BattleHudCard>
        </div>

        <BattleCommandBar
          dialogue={dialogue}
          isActive={isActive}
          isPending={isPending}
          isAnimating={isAnimating}
          pendingAction={pendingAction}
          onAction={handleAction}
        />
      </div>

      {isCompleted && allEntriesShown ? (
        <BattleOutcomeModal
          isWin={isWin}
          turnCount={session.turnCount}
          remainingHpPct={session.remainingHpPct}
          rewardClaimed={session.rewardClaimed}
          xpAwarded={session.xpAwarded}
          onReturn={() => navigate('/app/battle')}
        />
      ) : null}
    </div>
  )
}
