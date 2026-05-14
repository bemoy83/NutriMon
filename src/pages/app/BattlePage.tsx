import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  type BattleActionLabel,
  battleActionToPayload,
  BATTLE_SKILL_CATALOG,
} from '@/components/battle/battleActionConfig'
import { getPipCap, getFocusGain } from '@/lib/battlePerks'
import { BattleCommandBar } from '@/components/battle/BattleCommandBar'
import { BattleSkillModal } from '@/components/battle/BattleSkillModal'
import { BattleTurnTimeline } from '@/components/battle/BattleTurnTimeline'
import { BattleHudCard, BattleHudFocusPips, BattleHudHpBar } from '@/components/battle/BattleHudCard'
import { BattleParticles } from '@/components/battle/BattleParticles'
import { BattleArenaDressing } from '@/components/battle/BattleArenaDressing'
import { BattleOutcomeModal } from '@/components/battle/BattleOutcomeModal'
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
  getOpponentFootOffsets,
  getOpponentSpriteDescriptor,
  getPlayerBattleSpriteDescriptor,
  getPlayerTimelineIcon,
  getOpponentTimelineIcon,
} from '@/lib/sprites'
import { getBattleDialogue } from '@/lib/battleMessages'

// Player display size scales with companion stage (closer perspective = larger).
const PLAYER_DISPLAY_SIZE: Record<string, number> = {
  baby: 192,
  adult: 240,
  champion: 288,
}
function getPlayerSize(stage: string): number {
  return PLAYER_DISPLAY_SIZE[stage] ?? PLAYER_DISPLAY_SIZE.baby
}

// Preferred gap between the bottom of the opponent sprite and the top of the player sprite.
// CSS min() compresses this before either sprite clips a HUD zone.
const SPRITE_GAP = 40
const PLAYER_BOTTOM_PAD = 16  // matches bottom-4 on the player wrapper
const BATTLE_TOP_HUD_HEIGHT = 80
const BATTLE_COMMAND_BAR_HEIGHT = 160
const BATTLE_ARENA_MIN_HEIGHT = 320
const BATTLE_ARENA_MIN_HEIGHT_STYLE = `min(${BATTLE_ARENA_MIN_HEIGHT}px, calc(100dvh - ${BATTLE_TOP_HUD_HEIGHT + BATTLE_COMMAND_BAR_HEIGHT}px))`

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

function BattlePageSkeleton() {
  return (
    <div className="flex h-screen min-h-screen flex-col overflow-hidden bg-[var(--app-bg)]">
      <div
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #172033 0%, #111827 48%, #0f1018 100%)',
          contain: 'layout paint',
        }}
      >
        <div
          className="relative z-10 flex shrink-0 justify-center py-3"
          style={{ height: BATTLE_TOP_HUD_HEIGHT, minHeight: BATTLE_TOP_HUD_HEIGHT }}
        >
          <div className="h-10 w-64 rounded-full border border-white/10 bg-white/5" />
        </div>

        <div className="relative min-h-0 flex-1" style={{ minHeight: BATTLE_ARENA_MIN_HEIGHT_STYLE }}>
          <div
            className="absolute right-6"
            style={{ bottom: 248, width: 144, height: 144 }}
          >
            <div className="absolute inset-x-[-56px] bottom-[-6px] h-[120px] rounded-[50%] bg-white/5" />
            <div className="absolute inset-0 rounded-xl bg-white/5" />
          </div>
          <div
            className="absolute bottom-4 left-6"
            style={{ width: PLAYER_DISPLAY_SIZE.baby, height: PLAYER_DISPLAY_SIZE.baby }}
          >
            <div className="absolute inset-x-[-64px] bottom-0 h-[150px] rounded-[50%] bg-white/5" />
            <div className="absolute inset-0 rounded-xl bg-white/5" />
          </div>
        </div>

        <div
          className="shrink-0 border-t border-white/[0.06] bg-[#0f1018] p-3"
          style={{ height: BATTLE_COMMAND_BAR_HEIGHT, minHeight: BATTLE_COMMAND_BAR_HEIGHT }}
        />
      </div>
    </div>
  )
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
  const terrainAccentHex = session ? getArenaTerrain(session.opponent.arenaId).accentColor : undefined
  const arenaBackground = useTerrainBackground(terrainPlatformUrl, terrainAccentHex)

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
    playerMaxHp: session?.playerMaxHp ?? 0,
  })

  const [pendingAction, setPendingAction] = useState<BattleActionLabel | null>(null)
  const [skillModalOpen, setSkillModalOpen] = useState(false)

  const displayedLog =
    session && displayedLogOverride?.sessionId === session.id
      ? isAnimating || displayedLogOverride.entries.length > session.battleLog.length
        ? displayedLogOverride.entries
        : session.battleLog
      : session?.battleLog ?? []

  if (isLoading) return <BattlePageSkeleton />

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
  const oppFootOffsets = getOpponentFootOffsets(session.opponent.name)

  let opponentHp = session.opponentMaxHp
  let playerHp = session.playerMaxHp
  for (const entry of displayedLog) {
    if (entry.target === 'opponent' && entry.targetHpAfter !== null) opponentHp = entry.targetHpAfter
    if (entry.target === 'player' && entry.targetHpAfter !== null) playerHp = entry.targetHpAfter
  }

  const pipCap    = getPipCap(session.snapshot.level)
  const focusGain = getFocusGain(session.snapshot.level)

  // Derive pip count from the revealed log so it animates step-by-step
  // as entries are disclosed.
  const focusPips = displayedLog.reduce((count, e) => {
    if (e.actor !== 'player' || e.phase !== 'action') return count
    if (e.action === 'focus') return Math.min(pipCap, count + focusGain)
    if (e.action === 'skill') {
      const skillDef = BATTLE_SKILL_CATALOG.find(s => s.id === e.skillId)
      if (skillDef?.allPips) return 0
      return Math.max(0, count - (skillDef?.pipCost ?? 1))
    }
    return count
  }, 0)

  const isActive = session.status === 'active'
  const isCompleted = session.status === 'completed'
  const isWin = session.outcome === 'win'
  const allEntriesShown = displayedLog.length === session.battleLog.length
  const lastEntry = displayedLog[displayedLog.length - 1] ?? null

  // Show the "what will X do?" prompt once animation finishes and it's the player's turn.
  // During animation, show the last revealed action message instead.
  const isWaitingForInput = !isAnimating && isActive && allEntriesShown
  const displayedRound = isWaitingForInput
    ? session.currentRound
    : (lastEntry?.round ?? session.currentRound)

  const dialogue = isWaitingForInput
    ? `Round ${session.currentRound} — what will ${session.companion.name} do?`
    : lastEntry
      ? getBattleDialogue(lastEntry, session.companion.name, session.opponent.name, session.playerMaxHp, session.opponentMaxHp)
      : null

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
    <div className="flex h-screen min-h-screen flex-col overflow-hidden bg-[var(--app-bg)]">
      <div
        ref={arenaRef}
        className="relative flex flex-1 flex-col overflow-hidden"
        style={{
          background: arenaBackground,
          contain: 'layout paint',
        }}
      >
        {/* Particles sit behind all three zones */}
        <BattleParticles arenaId={session.opponent.arenaId} />
        {/* Arena atmosphere — remove by deleting this one line (and the import above) */}
        <BattleArenaDressing
          accentColor={terrain.accentColor}
          playerHpPct={session.playerMaxHp > 0 ? playerHp / session.playerMaxHp : 1}
        />

        {/* ── Zone 1: Turn order HUD — fixed top strip ── */}
        <div
          className="relative z-10 flex shrink-0 justify-center py-3"
          style={{ height: BATTLE_TOP_HUD_HEIGHT, minHeight: BATTLE_TOP_HUD_HEIGHT }}
        >
          <BattleTurnTimeline
            entries={displayedLog}
            fullLog={session.battleLog}
            currentRound={displayedRound}
            companionName={session.companion.name}
            opponentName={session.opponent.name}
            playerDescriptor={getPlayerTimelineIcon(session.companion.stage)}
            opponentDescriptor={getOpponentTimelineIcon(session.opponent.name)}
          />
        </div>

        {/* ── Zone 2: Battle zone — flex-1, sprites live here ── */}
        {/* --opp-bottom uses min() so the gap compresses before sprites clip a HUD zone */}
        <div
          className="relative min-h-0 flex-1"
          style={{
            minHeight: BATTLE_ARENA_MIN_HEIGHT_STYLE,
            '--player-h': `${playerDisplaySize}px`,
            '--opp-h': `${opponentDisplaySize}px`,
            '--sprite-gap': `${SPRITE_GAP}px`,
            '--player-pad': `${PLAYER_BOTTOM_PAD}px`,
          } as CSSProperties}
        >
          {/* z-stacking (low → high): opponent platform < opponent sprite < player platform < player sprite < HUD (z-10) */}
          <BattleHudCard
            className="left-4 max-sm:max-w-[calc(100vw-3.5rem-128px)]"
            style={{ top: 'max(4px, calc(100% - min(calc(var(--player-h) + var(--player-pad) + var(--sprite-gap)), calc(100% - var(--opp-h))) - var(--opp-h) - 8px))' }}
          >
            <div className="flex min-w-0 items-baseline justify-between">
              <p className="truncate text-sm font-bold text-white">{session.opponent.name}</p>
              <p className="ml-2 shrink-0 text-xs text-white/60">Lv{session.opponent.recommendedLevel}</p>
            </div>
            <p className="mt-0.5 text-xs font-semibold uppercase tracking-widest text-white/60">HP</p>
            <BattleHudHpBar current={opponentHp} max={session.opponentMaxHp} />
          </BattleHudCard>

          {/* Opponent platform + sprite share one container so they bob as a unit */}
          <div
            className="absolute right-6 z-[1] animate-battle-float-opponent"
            style={{
              bottom: 'min(calc(var(--player-h) + var(--player-pad) + var(--sprite-gap)), calc(100% - var(--opp-h)))',
              overflow: 'visible',
            }}
          >
            <div
              className="pointer-events-none"
              style={{ width: opponentDisplaySize, height: opponentDisplaySize, overflow: 'visible' }}
            >
              {terrain.opponentPlatformUrl && terrain.opponentPlatformWidth && (
                <img
                  src={terrain.opponentPlatformUrl}
                  alt=""
                  width={512}
                  height={240}
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                  draggable={false}
                  style={{
                    ...getCoLocatedPlatformStyle(
                      terrain.opponentPlatformWidth,
                      opponentDisplaySize,
                      oppFootOffsets.x,
                      terrain.opponentCalibration,
                      oppFootOffsets.y,
                    ),
                    zIndex: 0,
                  }}
                />
              )}
            </div>
            <div className="absolute inset-0 z-[3]" style={{ overflow: 'visible' }}>
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
          </div>

          <div
            className="absolute bottom-4 left-6 z-[4] animate-battle-float-player"
            style={{ width: playerDisplaySize, height: playerDisplaySize, overflow: 'visible' }}
          >
            {terrain.playerPlatformUrl && terrain.playerPlatformRenderedWidth != null && (
              <img
                src={terrain.playerPlatformUrl}
                alt=""
                width={512}
                height={240}
                loading="eager"
                fetchPriority="high"
                decoding="async"
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
            <BattleHudFocusPips count={focusPips} pipCap={pipCap} />
          </BattleHudCard>
        </div>

        {/* ── Zone 3: Command bar — fixed bottom strip ── */}
        <BattleCommandBar
          dialogue={dialogue}
          isActive={isActive}
          isPending={isPending}
          isAnimating={isAnimating}
          pendingAction={pendingAction}
          playerFocusPips={focusPips}
          onAction={handleAction}
        />

        {/* Full-arena overlay for special action flashes */}
        <SpecialActionFlash ref={specialFlashRef} />
      </div>

      {isCompleted && allEntriesShown ? (
        <BattleOutcomeModal
          isWin={isWin}
          turnCount={session.turnCount}
          remainingHpPct={session.remainingHpPct}
          rewardClaimed={session.rewardClaimed}
          xpAwarded={session.xpAwarded}
          totalXp={session.totalXp}
          onReturn={() => navigate('/app/battle')}
        />
      ) : null}

      <BattleSkillModal
        open={skillModalOpen}
        focusPips={focusPips}
        pipCap={pipCap}
        playerLevel={session.companion.level}
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
