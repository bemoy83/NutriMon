import {
  BATTLE_ACTION_LABELS,
  BATTLE_SKILL_CATALOG,
  type BattleActionLabel,
  battleActionButtonHoverClass,
  battleActionGhostColors,
  battleActionIcon,
} from '@/components/battle/battleActionConfig'
import { battleCommandBarSurfaceClass } from '@/components/battle/battleLayout'
import { useTypewriter } from '@/hooks/useTypewriter'

export function BattleCommandBar({
  dialogue,
  isActive,
  isPending,
  isAnimating,
  pendingAction,
  playerFocusPips,
  onAction,
}: {
  dialogue: string | null
  isActive: boolean
  isPending: boolean
  isAnimating: boolean
  pendingAction: BattleActionLabel | null
  playerFocusPips: number
  onAction: (label: BattleActionLabel) => void
}) {
  const isEnabled = isActive && !isPending && !isAnimating
  const isBusy = isAnimating || isPending
  const minSkillCost = Math.min(...BATTLE_SKILL_CATALOG.map(s => s.pipCost))
  const { displayed, isDone } = useTypewriter(dialogue)

  return (
    <div className={battleCommandBarSurfaceClass}>
      {/* Dialogue card */}
      <div
        className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden rounded-xl border border-white/[0.08] bg-[rgba(10,12,20,0.82)] px-4 py-3"
        style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}
      >
        <p className="text-sm leading-relaxed text-white/90">
          {displayed}
          {!isDone && (
            <span className="animate-pulse text-white/60">▮</span>
          )}
          {isDone && isBusy && (
            <span className="ml-0.5 animate-pulse text-white/50">···</span>
          )}
        </p>
        {isEnabled && isDone && (
          <div className="mt-2 h-1.5 w-1.5 animate-pulse rounded-sm bg-white/40" />
        )}
      </div>

      {/* 2×2 action grid: Attack Defend / Focus Skill */}
      <div className="grid w-44 shrink-0 grid-cols-2 grid-rows-2 gap-1.5">
        {BATTLE_ACTION_LABELS.map((label) => {
          const isThisPending = pendingAction === label
          const ghost = battleActionGhostColors[label]
          // Skill is pip-locked when the player doesn't have enough pips,
          // even if the rest of the UI is active.
          const isPipLocked = label === 'Skill' && isEnabled && playerFocusPips < minSkillCost
          const isButtonDisabled = !isEnabled || isPipLocked

          return (
            <button
              key={label}
              type="button"
              disabled={isButtonDisabled}
              onClick={() => onAction(label)}
              className={`flex h-full flex-col justify-center rounded-lg border px-2.5 text-left transition-[filter,opacity] ${
                !isEnabled
                  ? 'border-white/[0.06] bg-white/5 opacity-50'
                  : isPipLocked
                    ? 'cursor-not-allowed opacity-35'
                    : battleActionButtonHoverClass
              }`}
              style={isEnabled ? {
                background: ghost.bg,
                borderColor: ghost.border,
                color: ghost.text,
              } : undefined}
            >
              <span className="mb-0.5 block text-base leading-none" aria-hidden>
                {battleActionIcon[label]}
              </span>
              <span className="block text-sm font-semibold leading-tight">
                {isThisPending ? `${label}…` : label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
