import { BATTLE_SKILL_CATALOG } from '@/components/battle/battleActionConfig'


const KIND_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  attack: {
    text: 'var(--app-coral)',
    bg: 'rgba(232,106,92,0.15)',
    border: 'rgba(232,106,92,0.35)',
  },
  heal: {
    text: 'var(--app-success)',
    bg: 'rgba(52,211,153,0.15)',
    border: 'rgba(52,211,153,0.35)',
  },
  buff: {
    text: 'var(--app-resilience)',
    bg: 'rgba(14,165,233,0.15)',
    border: 'rgba(14,165,233,0.35)',
  },
}

export function BattleSkillModal({
  open,
  focusPips,
  pipCap,
  playerLevel,
  onPick,
  onClose,
}: {
  open: boolean
  focusPips: number
  pipCap: number
  playerLevel: number
  onPick: (skillId: string) => void
  onClose: () => void
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end backdrop-blur-[6px]"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
    >
      <div
        className="animate-slide-up-sheet w-full rounded-t-2xl border-t border-white/[0.08]"
        style={{
          background: 'rgba(10,12,20,0.97)',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.55)',
          maxHeight: '75vh',
          display: 'flex',
          flexDirection: 'column',
          paddingBottom: 'env(safe-area-inset-bottom, 16px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pb-3 pt-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/90">
            Select Skill
          </p>
          <div className="h-px flex-1 bg-white/[0.08]" />
          {/* FP pip display */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">FP</span>
            <div className="flex gap-1">
              {Array.from({ length: pipCap }).map((_, i) => (
                <div
                  key={i}
                  className="h-2.5 w-1.5 rounded-sm transition-all duration-200"
                  style={
                    i < focusPips
                      ? {
                          background: 'var(--app-warning)',
                          boxShadow: '0 0 4px rgba(245,158,11,0.65)',
                          border: '1px solid rgba(245,158,11,0.5)',
                        }
                      : {
                          background: 'rgba(255,255,255,0.10)',
                          border: '1px solid rgba(255,255,255,0.10)',
                        }
                  }
                />
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.06] text-sm text-white/50 hover:bg-white/10 hover:text-white/80"
          >
            ✕
          </button>
        </div>

        {/* Skill list */}
        <div className="flex flex-col gap-2 overflow-y-auto px-4 pb-4">
          {BATTLE_SKILL_CATALOG.map((skill) => {
            const levelLocked = playerLevel < skill.unlockLevel
            const affordable = !levelLocked && focusPips >= skill.pipCost
            const kindColor = KIND_COLORS[skill.kind] ?? KIND_COLORS.attack

            return (
              <button
                key={skill.id}
                type="button"
                disabled={!affordable}
                onClick={() => affordable && onPick(skill.id)}
                className="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-[background,opacity] duration-150"
                style={
                  levelLocked
                    ? {
                        background: 'rgba(255,255,255,0.01)',
                        borderColor: 'rgba(255,255,255,0.04)',
                        opacity: 0.35,
                        cursor: 'default',
                      }
                    : {
                        background: affordable ? 'rgba(245,158,11,0.07)' : 'rgba(255,255,255,0.02)',
                        borderColor: affordable ? 'rgba(245,158,11,0.22)' : 'rgba(255,255,255,0.06)',
                        opacity: affordable ? 1 : 0.4,
                        cursor: affordable ? 'pointer' : 'default',
                      }
                }
              >
                {/* Icon */}
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl"
                  style={{
                    background: affordable ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${affordable ? 'rgba(245,158,11,0.30)' : 'rgba(255,255,255,0.08)'}`,
                  }}
                >
                  {skill.icon}
                </div>

                {/* Name + badges + description */}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{skill.label}</span>
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                      style={{
                        color: kindColor.text,
                        background: kindColor.bg,
                        border: `1px solid ${kindColor.border}`,
                      }}
                    >
                      {skill.kind}
                    </span>
                    {levelLocked && (
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                        style={{
                          color: 'rgba(255,255,255,0.40)',
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.10)',
                        }}
                      >
                        Lv {skill.unlockLevel}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-white/50">{skill.description}</span>
                </div>

                {/* FP cost */}
                <div
                  className="flex shrink-0 flex-col items-center gap-0.5 pl-3"
                  style={{ borderLeft: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <span
                    className="text-base font-bold tabular-nums"
                    style={{ color: affordable ? 'var(--app-warning)' : 'rgba(255,255,255,0.25)' }}
                  >
                    {skill.pipCost}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
                    FP
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
