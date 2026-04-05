import {
  BATTLE_ACTION_LABELS,
  type BattleActionLabel,
  battleActionButtonClass,
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

  return (
    <div className={battleCommandBarSurfaceClass}>
      <div className="flex flex-1 items-center border-r border-white/10 px-5 py-4">
        <p className="text-sm leading-relaxed text-white/90">{dialogue}</p>
      </div>

      <div className="flex w-44 shrink-0 flex-col justify-center gap-1 px-4 py-3">
        {BATTLE_ACTION_LABELS.map((label) => {
          const isThisPending = pendingAction === label
          return (
            <button
              key={label}
              type="button"
              disabled={!isEnabled}
              onClick={() => onAction(label)}
              className={`rounded-lg px-3 py-3 text-left text-sm font-semibold transition-[filter,colors] ${
                isEnabled
                  ? `${battleActionButtonClass[label].enabled} ${battleActionButtonClass[label].hover}`
                  : 'bg-white/5 text-white/30 opacity-50'
              }`}
            >
              {isThisPending ? `${label}…` : label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
