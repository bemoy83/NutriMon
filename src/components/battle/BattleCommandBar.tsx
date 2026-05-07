import {
  BATTLE_ACTION_LABELS,
  type BattleActionLabel,
  battleActionButtonHoverClass,
  battleActionGhostColors,
  battleActionSubLabel,
} from '@/components/battle/battleActionConfig'
import { battleCommandBarSurfaceClass } from '@/components/battle/battleLayout'

export function BattleCommandBar({
  dialogue,
  isActive,
  isPending,
  isAnimating,
  pendingAction,
  onAction,
}: {
  dialogue: string | null
  isActive: boolean
  isPending: boolean
  isAnimating: boolean
  pendingAction: BattleActionLabel | null
  onAction: (label: BattleActionLabel) => void
}) {
  const isEnabled = isActive && !isPending && !isAnimating
  const isBusy = isAnimating || isPending

  return (
    <div className={battleCommandBarSurfaceClass}>
      {/* Dialogue card */}
      <div
        className="flex flex-1 flex-col justify-center rounded-xl border border-white/[0.08] bg-[rgba(10,12,20,0.82)] px-4 py-3"
        style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}
      >
        <p className="text-sm leading-relaxed text-white/90">
          {dialogue}
          {isBusy && <span className="ml-0.5 animate-pulse text-white/50">···</span>}
        </p>
        {isEnabled && (
          <div className="mt-2 h-1.5 w-1.5 animate-pulse rounded-sm bg-white/40" />
        )}
      </div>

      {/* Action buttons */}
      <div className="flex w-44 shrink-0 flex-col gap-1">
        {BATTLE_ACTION_LABELS.map((label) => {
          const isThisPending = pendingAction === label
          const ghost = battleActionGhostColors[label]
          return (
            <button
              key={label}
              type="button"
              disabled={!isEnabled}
              onClick={() => onAction(label)}
              className={`flex flex-1 flex-col justify-center rounded-lg border px-3 text-left transition-[filter] ${
                isEnabled
                  ? battleActionButtonHoverClass
                  : 'border-white/[0.06] bg-white/5 opacity-50'
              }`}
              style={isEnabled ? {
                background: ghost.bg,
                borderColor: ghost.border,
                color: ghost.text,
              } : undefined}
            >
              <span className="block text-sm font-semibold leading-tight">
                {isThisPending ? `${label}…` : label}
              </span>
              <span className="mt-0.5 block text-[10px] font-medium leading-tight opacity-60">
                {battleActionSubLabel[label]}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
