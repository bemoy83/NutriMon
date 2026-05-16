export interface GuardEffect {
  id: number
  durationMs: number
}

export interface GuardImpactEffect {
  id: number
  intensity: 'normal' | 'heavy'
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
  guardImpacts,
  persistentGuardState,
  persistentGuardKey,
  displaySize,
}: {
  guards: GuardEffect[]
  guardImpacts: GuardImpactEffect[]
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

      {guardImpacts.map((impact) => {
        const heavy = impact.intensity === 'heavy'
        const fragmentCount = heavy ? 9 : 6
        return (
          <div
            key={impact.id}
            data-testid="battle-guard-impact"
            data-intensity={impact.intensity}
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
                background: 'radial-gradient(circle, transparent 48%, rgba(191,239,255,0.30) 68%, rgba(125,211,252,0.72) 86%, transparent 100%)',
                border: `${heavy ? 4 : 3}px solid rgba(186,230,253,0.95)`,
                boxShadow: heavy
                  ? 'inset 0 0 30px rgba(186,230,253,0.62), 0 0 24px rgba(56,189,248,0.72), 0 0 42px rgba(14,165,233,0.42)'
                  : 'inset 0 0 24px rgba(186,230,253,0.48), 0 0 18px rgba(56,189,248,0.56)',
                animation: 'shield-impact-compress 360ms cubic-bezier(0.15,0.9,0.2,1) forwards',
                overflow: 'hidden',
              }}
            >
              <HexPattern
                patternId={`impact-hex-${impact.id}`}
                gradientId={`impact-hex-grad-${impact.id}`}
                maskId={`impact-hex-mask-${impact.id}`}
                opacity={heavy ? 0.56 : 0.42}
              />
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  width: '42%',
                  background: 'linear-gradient(90deg, transparent, rgba(236,254,255,0.95), transparent)',
                  animation: 'shield-impact-glint 360ms ease-out forwards',
                }}
              />
            </div>

            <div
              style={{
                position: 'absolute',
                left: cx - r,
                top: cy - r,
                width: r * 2,
                height: r * 2,
                borderRadius: '50%',
                border: `${heavy ? 4 : 3}px solid rgba(224,251,255,0.95)`,
                boxShadow: '0 0 18px rgba(125,211,252,0.72)',
                animation: 'shield-impact-rim 360ms ease-out forwards',
              }}
            />

            {Array.from({ length: fragmentCount }).map((_, i) => {
              const angle = ((i / fragmentCount) * Math.PI * 2) - Math.PI * 0.42
              const startR = r * (heavy ? 0.84 : 0.78)
              const x = cx + Math.cos(angle) * startR
              const y = cy + Math.sin(angle) * startR
              const travel = heavy ? 18 : 12
              return (
                <span
                  key={i}
                  style={{
                    position: 'absolute',
                    left: x,
                    top: y,
                    width: heavy ? 6 : 5,
                    height: heavy ? 6 : 5,
                    marginLeft: heavy ? -3 : -2.5,
                    marginTop: heavy ? -3 : -2.5,
                    borderRadius: 2,
                    border: '1px solid rgba(224,251,255,0.92)',
                    background: 'rgba(125,211,252,0.38)',
                    boxShadow: '0 0 7px rgba(125,211,252,0.75)',
                    ['--dx' as string]: `${Math.cos(angle) * travel}px`,
                    ['--dy' as string]: `${Math.sin(angle) * travel}px`,
                    animation: `shield-impact-fragment 360ms ease-out ${i * 14}ms forwards`,
                    opacity: 0,
                  } as React.CSSProperties}
                />
              )
            })}
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
