import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import LoadingState from '@/components/ui/LoadingState'
import CreatureSprite from '@/components/ui/CreatureSprite'
import type { CreatureSpriteHandle } from '@/components/ui/CreatureSprite'
import SpriteStage from '@/components/ui/SpriteStage'
import EffectsLayer from '@/components/ui/EffectsLayer'
import type { EffectsLayerHandle } from '@/components/ui/EffectsLayer'
import { useBattleRun, useSubmitBattleAction } from '@/features/creature/useBattleRun'
import { getPlayerBattleSpriteDescriptor, getOpponentSpriteDescriptor, getOpponentRecoverySpriteDescriptor, getArenaTerrain, getHitImpactUrl } from '@/lib/sprites'
import { useTerrainBackground } from '@/hooks/useTerrainBackground'
import type { BattleAction, BattleLogEntry } from '@/types/domain'

const ENTRY_DELAY_MS = 1200

// Perspective depth scaling — player is always larger than opponent to sell the
// "player is closer to camera" feel. Matches the Pokémon convention.
const STAGE_DISPLAY_SIZES: Record<string, { player: number; opponent: number }> = {
  baby:     { player: 144, opponent: 128 },
  adult:    { player: 176, opponent: 160 },
  champion: { player: 208, opponent: 184 },
}
function getStageSizes(stage: string) {
  return STAGE_DISPLAY_SIZES[stage] ?? STAGE_DISPLAY_SIZES.baby
}

const ACTION_LABELS = ['Attack', 'Defend', 'Focus'] as const
type ActionLabel = (typeof ACTION_LABELS)[number]

const ACTION_MAP: Record<ActionLabel, BattleAction> = {
  Attack: 'attack',
  Defend: 'defend',
  Focus: 'focus',
}

function HpBar({ current, max, color }: { current: number; max: number; color: 'brand' | 'danger' }) {
  const pct = max > 0 ? Math.round((current / max) * 100) : 0
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--app-border)]">
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{
          width: `${pct}%`,
          background: color === 'danger' ? 'var(--app-danger)' : 'var(--app-brand)',
        }}
      />
    </div>
  )
}

export default function BattlePage() {
  const { battleRunId } = useParams<{ battleRunId: string }>()
  const navigate = useNavigate()
  const animTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  // Sprite refs
  const arenaRef = useRef<HTMLDivElement>(null)
  const playerSpriteRef = useRef<CreatureSpriteHandle>(null)
  const opponentSpriteRef = useRef<CreatureSpriteHandle>(null)
  const playerEffectsRef = useRef<EffectsLayerHandle>(null)
  const opponentEffectsRef = useRef<EffectsLayerHandle>(null)

  const { data: session, isLoading, error } = useBattleRun(battleRunId)
  const { mutate: submitAction, isPending } = useSubmitBattleAction()

  // Terrain is derived from session but the hook must be called unconditionally
  const terrainPlatformUrl = session ? getArenaTerrain(session.opponent.arenaId).playerPlatformUrl : null
  const arenaBackground = useTerrainBackground(terrainPlatformUrl)

  const [displayedLogOverride, setDisplayedLogOverride] = useState<{
    sessionId: string
    entries: BattleLogEntry[]
  } | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const [pendingAction, setPendingAction] = useState<ActionLabel | null>(null)
  const [showOpponentRecovery, setShowOpponentRecovery] = useState(false)

  const displayedLog =
    session && displayedLogOverride?.sessionId === session.id
      ? isAnimating || displayedLogOverride.entries.length > session.battleLog.length
        ? displayedLogOverride.entries
        : session.battleLog
      : session?.battleLog ?? []

  function triggerArenaShake() {
    const el = arenaRef.current
    if (!el) return
    el.classList.remove('animate-shake')
    void el.offsetWidth
    el.classList.add('animate-shake')
    setTimeout(() => el.classList.remove('animate-shake'), 400)
  }

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

          // Trigger sprite effects for this entry
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

          // Faint when HP reaches 0
          if (entry.targetHpAfter === 0) {
            if (entry.target === 'player') {
              playerSpriteRef.current?.triggerAnimation('faint', 1200)
            } else if (entry.target === 'opponent') {
              opponentSpriteRef.current?.triggerAnimation('faint', 1200)
              // Swap to recovery sprite once the faint animation completes
              const rt = setTimeout(() => setShowOpponentRecovery(true), 1200)
              animTimers.current.push(rt)
            }
          }

          if (i === newEntries.length - 1) {
            setIsAnimating(false)
          }
        }, i * ENTRY_DELAY_MS)
        animTimers.current.push(t)
      })
    },
    [],
  )

  useEffect(() => {
    return () => animTimers.current.forEach(clearTimeout)
  }, [])

  if (isLoading) return <LoadingState fullScreen />

  if (error || !session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--app-bg)] px-6">
        <p className="text-center text-sm text-[var(--app-text-secondary)]">
          {error instanceof Error ? error.message : 'Unable to load battle.'}
        </p>
        <button
          type="button"
          onClick={() => navigate('/app/creature')}
          className="rounded-xl bg-[var(--app-brand)] px-5 py-3 text-sm font-semibold text-white"
        >
          Return to Companion
        </button>
      </div>
    )
  }

  const terrain = getArenaTerrain(session.opponent.arenaId)
  const hitImpactUrl = getHitImpactUrl()
  const { player: playerDisplaySize, opponent: opponentDisplaySize } = getStageSizes(session.companion.stage)

  // Derive current HP by replaying targetHpAfter from displayed log
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

  function handleAction(label: ActionLabel) {
    if (!session || !isActive || isPending || isAnimating) return
    const prevLog = [...displayedLog]
    setPendingAction(label)
    submitAction(
      { battleRunId: session.id, action: ACTION_MAP[label] },
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

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--app-bg)]">
      {/* ── Arena ─────────────────────────────────────────────────── */}
      <div ref={arenaRef} className="relative flex-1 overflow-hidden" style={{ background: arenaBackground }}>

        {/* ── Terrain layer (z-0) ─────────────────────────────────── */}
        {/* Player platform — style from terrain registry centers oval under player sprite */}
        {terrain.playerPlatformUrl && terrain.playerPlatformStyle && (
          <img
            src={terrain.playerPlatformUrl}
            alt=""
            draggable={false}
            className="absolute z-0 object-contain"
            style={terrain.playerPlatformStyle}
          />
        )}
        {/* Opponent platform — style from terrain registry anchors at opponent sprite feet */}
        {terrain.opponentPlatformUrl && terrain.opponentPlatformStyle && (
          <img
            src={terrain.opponentPlatformUrl}
            alt=""
            draggable={false}
            className="absolute z-0 object-contain"
            style={terrain.opponentPlatformStyle}
          />
        )}

        {/* Opponent HP panel — top-left, aligned with opponent sprite top (z-10) */}
        <div className="absolute left-4 z-10 w-44 max-sm:min-w-[10.25rem] max-sm:w-auto max-sm:max-w-[calc(100vw-3.5rem-128px)] rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 shadow-sm max-sm:px-2.5" style={{ top: 'calc(28% - 8px)' }}>
          <div className="flex min-w-0 items-baseline justify-between">
            <p className="truncate text-sm font-bold text-[var(--app-text-primary)]">
              {session.opponent.name}
            </p>
            <p className="ml-2 shrink-0 text-xs text-[var(--app-text-muted)]">
              Lv{session.opponent.recommendedLevel}
            </p>
          </div>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--app-text-muted)]">
            HP
          </p>
          <HpBar current={opponentHp} max={session.opponentMaxHp} color="danger" />
        </div>

        {/* Opponent sprite — right, 28% down — synced with OPP_SPRITE_TOP_PCT in sprites.ts (z-20) */}
        <div className="absolute top-[28%] right-6 z-20">
          <SpriteStage displaySize={opponentDisplaySize} contactShadow>
            <CreatureSprite
              ref={opponentSpriteRef}
              descriptor={
                showOpponentRecovery
                  ? (getOpponentRecoverySpriteDescriptor(session.opponent.name) ?? getOpponentSpriteDescriptor(session.opponent.name))
                  : getOpponentSpriteDescriptor(session.opponent.name)
              }
              displaySize={opponentDisplaySize}
              flip={false}
            />
            <EffectsLayer ref={opponentEffectsRef} hitImpactUrl={hitImpactUrl ?? undefined} />
          </SpriteStage>
        </div>

        {/* Player sprite — bottom-left, art faces right (z-20) */}
        <div className="absolute bottom-4 left-6 z-20">
          <SpriteStage displaySize={playerDisplaySize} contactShadow>
            <CreatureSprite
              ref={playerSpriteRef}
              descriptor={getPlayerBattleSpriteDescriptor(session.companion.stage, session.companion.currentCondition)}
              displaySize={playerDisplaySize}
              flip={false}
            />
            <EffectsLayer ref={playerEffectsRef} hitImpactUrl={hitImpactUrl ?? undefined} />
          </SpriteStage>
        </div>

        {/* Player HP panel — bottom-right, vertically centred on player sprite (z-10) */}
        <div className="absolute right-4 bottom-10 z-10 w-44 max-sm:min-w-[10.25rem] max-sm:w-auto max-sm:max-w-[min(11rem,calc(100vw-3.5rem-128px))] rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 shadow-sm max-sm:px-2.5">
          <div className="flex min-w-0 items-baseline justify-between">
            <p className="truncate text-sm font-bold text-[var(--app-text-primary)]">
              {session.companion.name}
            </p>
            <p className="ml-2 shrink-0 text-xs text-[var(--app-text-muted)]">
              Lv{session.companion.level}
            </p>
          </div>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--app-text-muted)]">
            HP
          </p>
          <HpBar current={playerHp} max={session.playerMaxHp} color="brand" />
          <p className="mt-1 text-right text-xs tabular-nums text-[var(--app-text-secondary)]">
            {playerHp} / {session.playerMaxHp}
          </p>
        </div>
      </div>

      {/* ── Divider ───────────────────────────────────────────────── */}
      <div className="h-px shrink-0 bg-[var(--app-border)]" />

      {/* ── Bottom UI ─────────────────────────────────────────────── */}
      <div className="flex shrink-0 bg-[var(--app-surface)]" style={{ height: '11rem' }}>
        {/* Text box — left */}
        <div className="flex flex-1 items-center border-r border-[var(--app-border)] px-5 py-4">
          <p className="text-sm leading-relaxed text-[var(--app-text-primary)]">
            {lastEntry
              ? lastEntry.message
              : isActive
                ? `Round ${session.currentRound} — what will ${session.companion.name} do?`
                : null}
          </p>
        </div>

        {/* Action menu — right */}
        <div className="flex w-44 shrink-0 flex-col justify-center gap-1 px-4 py-3">
          {ACTION_LABELS.map((label) => {
            const isEnabled = isActive && !isPending && !isAnimating
            const isThisPending = pendingAction === label

            return (
              <button
                key={label}
                type="button"
                disabled={!isEnabled}
                onClick={() => handleAction(label)}
                className={`rounded-lg px-3 py-1.5 text-left text-sm font-semibold transition-colors ${
                  isEnabled
                    ? 'bg-[var(--app-brand)] text-white hover:bg-[var(--app-brand-hover)]'
                    : 'bg-[var(--app-surface-muted)] text-[var(--app-text-muted)] opacity-50'
                }`}
              >
                {isThisPending ? `${label}…` : label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Victory / Defeat modal ────────────────────────────────── */}
      {isCompleted && allEntriesShown ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 text-center shadow-xl">
            <p
              className={`text-4xl font-extrabold ${isWin ? 'text-[var(--app-success)]' : 'text-[var(--app-danger)]'}`}
            >
              {isWin ? 'Victory!' : 'Defeat...'}
            </p>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-[var(--app-surface-muted)] px-2 py-3">
                <p className="text-xs text-[var(--app-text-muted)]">Rounds</p>
                <p className="mt-1 font-semibold text-[var(--app-text-primary)]">
                  {session.turnCount ?? '—'}
                </p>
              </div>
              <div className="rounded-xl bg-[var(--app-surface-muted)] px-2 py-3">
                <p className="text-xs text-[var(--app-text-muted)]">HP Left</p>
                <p className="mt-1 font-semibold text-[var(--app-text-primary)]">
                  {session.remainingHpPct ?? 0}%
                </p>
              </div>
              <div className="rounded-xl bg-[var(--app-surface-muted)] px-2 py-3">
                <p className="text-xs text-[var(--app-text-muted)]">XP</p>
                <p className="mt-1 font-semibold text-[var(--app-text-primary)]">
                  {session.rewardClaimed ? `+${session.xpAwarded}` : '—'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate('/app/creature')}
              className="mt-5 w-full rounded-xl bg-[var(--app-brand)] py-3 text-base font-semibold text-white transition-colors hover:bg-[var(--app-brand-hover)]"
            >
              Return to Companion
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
