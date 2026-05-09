import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  type BattleActionLabel,
  battleActionToPayload,
} from '@/components/battle/battleActionConfig'
import { BattleCommandBar } from '@/components/battle/BattleCommandBar'
import { BattleSkillModal } from '@/components/battle/BattleSkillModal'
import { BattleHudCard, BattleHudFocusPips, BattleHudHpBar } from '@/components/battle/BattleHudCard'
import { battleArenaCmdBarVars, battleGameplayBandClass } from '@/components/battle/battleLayout'
import { BattleOutcomeModal } from '@/components/battle/BattleOutcomeModal'
import LoadingState from '@/components/ui/LoadingState'
import CreatureSprite from '@/components/ui/CreatureSprite'
import type { CreatureSpriteHandle } from '@/components/ui/CreatureSprite'
import SpriteStage from '@/components/ui/SpriteStage'
import EffectsLayer from '@/components/ui/EffectsLayer'
import type { EffectsLayerHandle } from '@/components/ui/EffectsLayer'
import SpecialActionFlash from '@/components/ui/SpecialActionFlash'
import type { SpecialActionFlashHandle } from '@/components/ui/SpecialActionFlash'
import { useBattleRun, useSubmitBattleAction } from '@/features/creature/useBattleRun'
import { useBattleLogReveal } from '@/hooks/useBattleLogReveal'
import { useTerrainBackground } from '@/hooks/useTerrainBackground'
import {
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

// Opponent sprite size scales with size_class. The platform is always rendered
// at its registered width (fixed depth), so size_class reads as physical creature
// size rather than camera distance.
const OPPONENT_SIZE_BY_CLASS: Record<string, number> = {
  small: 96,
  medium: 144,
  large: 192,
}

function getOpponentSize(sizeClass: string): number {
  return OPPONENT_SIZE_BY_CLASS[sizeClass] ?? OPPONENT_SIZE_BY_CLASS.medium
}

export default function BattlePage() {
  const { battleRunId } = useParams<{ battleRunId: string }>()
  const navigate = useNavigate()

  // Fade in from black — mirrors the fade-out on BattleHubPage.
  const [fadeVisible, setFadeVisible] = useState(true)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setFadeVisible(false))
    return () => cancelAnimationFrame(frame)
  }, [])

  const arenaRef = useRef<HTMLDivElement>(null)
  const playerSpriteRef = useRef<CreatureSpriteHandle>(null)
  const opponentSpriteRef = useRef<CreatureSpriteHandle>(null)
  const playerEffectsRef = useRef<EffectsLayerHandle>(null)
  const opponentEffectsRef = useRef<EffectsLayerHandle>(null)
  const specialFlashRef = useRef<SpecialActionFlashHandle>(null)

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
    specialFlashRef,
  })

  const [pendingAction, setPendingAction] = useState<BattleActionLabel | null>(null)
  const [skillModalOpen, setSkillModalOpen] = useState(false)

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

  // Derive pip count from the revealed log so it animates step-by-step
  // as entries are disclosed. Focus adds 1 (capped at 3); Skill subtracts 1.
  const FOCUS_PIP_MAX = 3
  const focusPips = displayedLog.reduce((count, e) => {
    if (e.actor !== 'player' || e.phase !== 'action') return count
    if (e.action === 'focus') return Math.min(FOCUS_PIP_MAX, count + 1)
    if (e.action === 'skill') return Math.max(0, count - 1)
    return count
  }, 0)

  const isActive = session.status === 'active'
  const isCompleted = session.status === 'completed'
  const isWin = session.outcome === 'win'
  const allEntriesShown = displayedLog.length === session.battleLog.length
  const lastEntry = displayedLog[displayedLog.length - 1] ?? null

  const dialogue =
    lastEntry?.message ??
    (isActive ? `Round ${session.currentRound} — what will ${session.companion.name} do?` : null)

  function submitBattleAction(label: BattleActionLabel, skillId?: string) {
    if (!session) return
    const prevLog = [...displayedLog]
    setPendingAction(label)
    submitAction(
      { battleRunId: session.id, action: battleActionToPayload[label], skillId },
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

  function handleAction(label: BattleActionLabel) {
    if (!session || !isActive || isPending || isAnimating) return
    if (label === 'Skill') {
      setSkillModalOpen(true)
      return
    }
    submitBattleAction(label)
  }

  function handleSkillPick(skillId: string) {
    setSkillModalOpen(false)
    submitBattleAction('Skill', skillId)
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--app-bg)]">
      <div
        ref={arenaRef}
        className="relative flex-1 overflow-hidden"
        style={{ background: arenaBackground, ...battleArenaCmdBarVars() }}
      >
        <div className={battleGameplayBandClass}>
          <BattleHudCard
            className="left-4 max-sm:max-w-[calc(100vw-3.5rem-128px)]"
            style={{ top: 'calc(28% - 8px)' }}
          >
            <div className="flex min-w-0 items-baseline justify-between">
              <p className="truncate text-sm font-bold text-white">{session.opponent.name}</p>
              <p className="ml-2 shrink-0 text-xs text-white/60">Lv{session.opponent.recommendedLevel}</p>
            </div>
            <p className="mt-0.5 text-xs font-semibold uppercase tracking-widest text-white/60">HP</p>
            <BattleHudHpBar current={opponentHp} max={session.opponentMaxHp} />
          </BattleHudCard>

          {/* z-stacking (low → high): opponent platform < opponent sprite < player platform < player sprite < HUD (z-10) */}
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
                    terrain.opponentPlatformWidth,
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

          <div
            className="absolute bottom-4 left-6 z-[4]"
            style={{ width: playerDisplaySize, height: playerDisplaySize, overflow: 'visible' }}
          >
            {terrain.playerPlatformUrl && terrain.playerPlatformRenderedWidth != null && (
              <img
                src={terrain.playerPlatformUrl}
                alt=""
                draggable={false}
                className="pointer-events-none absolute z-[2] object-contain"
                style={{
                  ...getCoLocatedPlatformStyle(
                    terrain.playerPlatformRenderedWidth,
                    playerDisplaySize,
                    0,
                    terrain.playerPlatformCalibration,
                  ),
                  zIndex: 2,
                }}
              />
            )}
            <SpriteStage className="z-[3]" displaySize={playerDisplaySize} contactShadow>
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
            <BattleHudHpBar current={playerHp} max={session.playerMaxHp} />
            <p className="mt-1 text-right text-xs tabular-nums text-white/70">
              {playerHp} / {session.playerMaxHp}
            </p>
            <BattleHudFocusPips count={focusPips} />
          </BattleHudCard>
        </div>

        <BattleCommandBar
          dialogue={dialogue}
          isActive={isActive}
          isPending={isPending}
          isAnimating={isAnimating}
          pendingAction={pendingAction}
          playerFocusPips={focusPips}
          onAction={handleAction}
        />

        <SpecialActionFlash ref={specialFlashRef} />
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

      <BattleSkillModal
        open={skillModalOpen}
        focusPips={focusPips}
        onPick={handleSkillPick}
        onClose={() => setSkillModalOpen(false)}
      />

      {/* Fade from black on mount */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          background: '#000',
          opacity: fadeVisible ? 1 : 0,
          transition: fadeVisible ? undefined : 'opacity 0.35s ease-out',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}
