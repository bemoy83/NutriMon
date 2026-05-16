export interface SpeedlineItem {
  angle: number
  innerPx: number
  lenPx: number
  thickPx: number
  delayMs: number
}

export interface SpeedlineEffect {
  id: number
  cx: number
  cy: number
  items: SpeedlineItem[]
}

export function SpeedlineEffects({ speedlines }: { speedlines: SpeedlineEffect[] }) {
  return (
    <>
      {speedlines.map((s) => (
        <div
          key={s.id}
          data-testid="battle-speedlines"
          style={{ position: 'absolute', left: s.cx, top: s.cy, width: 0, height: 0, pointerEvents: 'none' }}
        >
          {s.items.map((line, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: 0,
                height: 0,
                transform: `rotate(${line.angle}deg) translateX(${line.innerPx}px)`,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: line.lenPx,
                  height: line.thickPx,
                  marginTop: -line.thickPx / 2,
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,220,0.88) 25%, rgba(255,255,220,0.88) 75%, transparent)',
                  borderRadius: 99,
                  transformOrigin: '0 50%',
                  filter: 'drop-shadow(0 0 2px rgba(255,255,200,0.7))',
                  animation: `battle-speedline-in 460ms cubic-bezier(0.2,0.85,0.3,1) ${line.delayMs}ms forwards`,
                  opacity: 0,
                }}
              />
            </div>
          ))}
        </div>
      ))}
    </>
  )
}
