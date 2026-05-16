export interface GuardEffect {
  id: number
  durationMs: number
}

export type PersistentGuardState = 'hidden' | 'active' | 'dismissing'

function HexPattern({
  patternId,
  gradientId,
  maskId,
  opacity,
}: {
  patternId: string
  gradientId: string
  maskId: string
  opacity: number
}) {
  return (
    <svg
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0, opacity }}
      aria-hidden="true"
    >
      <defs>
        <pattern id={patternId} width="16" height="14" patternUnits="userSpaceOnUse">
          <polygon
            points="8,1 15,4.5 15,10.5 8,14 1,10.5 1,4.5"
            fill="none"
            stroke="rgba(74,172,223,0.9)"
            strokeWidth="0.6"
          />
        </pattern>
        <radialGradient id={gradientId}>
          <stop offset="0%"   stopColor="white" stopOpacity="0" />
          <stop offset="60%"  stopColor="white" stopOpacity="0.4" />
          <stop offset="100%" stopColor="white" stopOpacity="1" />
        </radialGradient>
        <mask id={maskId}>
          <rect width="100%" height="100%" fill={`url(#${gradientId})`} />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} mask={`url(#${maskId})`} />
    </svg>
  )
}

export function GuardEffects({
  guards,
  persistentGuardState,
  persistentGuardKey,
  displaySize,
}: {
  guards: GuardEffect[]
  persistentGuardState: PersistentGuardState
  persistentGuardKey: number
  displaySize?: number
}) {
  const ds = displaySize ?? 128
  const cx = ds / 2
  const cy = ds * 0.44
  const r = ds * 0.46

  return (
    <>
      {guards.map((g) => {
        const hexPatternId = `vfx-hex-${g.id}`
        const hexGradId = `vfx-hex-grad-${g.id}`
        const hexMaskId = `vfx-hex-mask-${g.id}`
        return (
          <div
            key={g.id}
            data-testid="battle-defend-guard"
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          >
            <div
              style={{
                position: 'absolute',
                left: cx - r,
                top: cy - r,
                width: r * 2,
                height: r * 2,
                borderRadius: '50%',
                background: 'radial-gradient(circle, transparent 55%, rgba(74,172,223,0.38) 75%, rgba(74,172,223,0.62) 88%, transparent 100%)',
                border: '2px solid rgba(74,172,223,0.88)',
                boxShadow: 'inset 0 0 28px rgba(74,172,223,0.48), 0 0 22px rgba(74,172,223,0.42)',
                animation: `shield-dome-in ${g.durationMs}ms cubic-bezier(0.25,0.8,0.3,1) forwards`,
                overflow: 'hidden',
              }}
            >
              <HexPattern patternId={hexPatternId} gradientId={hexGradId} maskId={hexMaskId} opacity={0.42} />
            </div>

            <div
              style={{
                position: 'absolute',
                left: cx - r,
                top: cy - r,
                width: r * 2,
                height: r * 2,
                borderRadius: '50%',
                border: '3px solid rgba(74,172,223,0.88)',
                boxShadow: '0 0 16px rgba(74,172,223,0.65)',
                animation: `aura-ring-out 700ms ease-out 80ms forwards`,
                opacity: 0,
              }}
            />
          </div>
        )
      })}

      {persistentGuardState !== 'hidden' && (() => {
        const dismissing = persistentGuardState === 'dismissing'
        const hexPid = `p-hex-p-${persistentGuardKey}`
        const hexGid = `p-hex-g-${persistentGuardKey}`
        const hexMid = `p-hex-m-${persistentGuardKey}`
        return (
          <div
            key={persistentGuardKey}
            data-testid="battle-persistent-guard"
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          >
            {!dismissing && (
              <div
                style={{
                  position: 'absolute',
                  left: cx - r,
                  top: cy - r,
                  width: r * 2,
                  height: r * 2,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, transparent 55%, rgba(74,172,223,0.48) 75%, rgba(74,172,223,0.70) 88%, transparent 100%)',
                  border: '2px solid rgba(74,172,223,0.88)',
                  boxShadow: 'inset 0 0 28px rgba(74,172,223,0.48), 0 0 22px rgba(74,172,223,0.42)',
                  animation: 'shield-dome-in 900ms cubic-bezier(0.25,0.8,0.3,1) forwards',
                  overflow: 'hidden',
                }}
              >
                <HexPattern patternId={hexPid} gradientId={hexGid} maskId={hexMid} opacity={0.42} />
              </div>
            )}

            {!dismissing && (
              <div
                style={{
                  position: 'absolute',
                  left: cx - r,
                  top: cy - r,
                  width: r * 2,
                  height: r * 2,
                  borderRadius: '50%',
                  border: '3px solid rgba(74,172,223,0.88)',
                  boxShadow: '0 0 16px rgba(74,172,223,0.65)',
                  animation: 'aura-ring-out 700ms ease-out 80ms forwards',
                  opacity: 0,
                }}
              />
            )}

            <div
              style={{
                position: 'absolute',
                left: cx - r,
                top: cy - r,
                width: r * 2,
                height: r * 2,
                borderRadius: '50%',
                background: 'radial-gradient(circle, transparent 55%, rgba(74,172,223,0.26) 75%, rgba(74,172,223,0.45) 88%, transparent 100%)',
                border: '2px solid rgba(74,172,223,0.68)',
                boxShadow: 'inset 0 0 20px rgba(74,172,223,0.30), 0 0 16px rgba(74,172,223,0.26)',
                animation: dismissing
                  ? 'dome-dissolve 400ms ease-out forwards'
                  : 'persistent-dome-pulse 2.2s ease-in-out infinite',
                overflow: 'hidden',
              }}
            >
              <HexPattern patternId={hexPid} gradientId={hexGid} maskId={hexMid} opacity={0.30} />
              {!dismissing && (
                <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      width: '38%',
                      background: 'linear-gradient(90deg, transparent, rgba(207,233,255,0.72), transparent)',
                      animation: 'dome-glint 3.5s ease-out 1.1s infinite',
                      opacity: 0,
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )
      })()}
    </>
  )
}
