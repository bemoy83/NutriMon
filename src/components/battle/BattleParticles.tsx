import { useMemo } from 'react'

// Arena UUID → biome particle type
const ARENA_BIOME: Record<string, 'leaf' | 'firefly' | 'ash' | 'snow' | 'ember'> = {
  '37543fca-9f22-41c7-83b5-2ded30d7b063': 'leaf',     // Verdantroot Forest
  'ca277fd4-1dd0-4e6e-a50b-c95bbd878395': 'firefly',  // Murkmire Wetlands
  'a353973e-46fe-4757-a90d-a409beddc644': 'ash',      // Ashrock Highlands
  'eae801b3-fac1-4d10-9b40-ea652865c57c': 'snow',     // Frostveil Peaks
  'af76c388-9746-4484-8ab5-bfa9f16349f9': 'ember',    // Sunforge Summit
}

const PRESETS = {
  leaf:    { count: 14, color: '#9bd66a', secondaryColor: '#5aa840' },
  firefly: { count: 12, color: '#d8e860', glowColor: '#d8e86080' },
  ash:     { count: 18, color: '#c4b8ad' },
  snow:    { count: 26, color: '#ffffff' },
  ember:   { count: 22, color: '#ffaa3a', coreColor: '#fff5cc', tailColor: '#ff5020' },
}

function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

interface Particle {
  x: number
  y: number
  size: number
  dur: number
  delay: number
  rot: number
}

function useParticles(count: number, seed: number): Particle[] {
  return useMemo(() => {
    const rnd = seededRandom(seed)
    return Array.from({ length: count }, () => ({
      x: rnd() * 100,
      y: rnd() * 100,
      size: 2 + rnd() * 4,
      dur: 4 + rnd() * 8,
      delay: -rnd() * 12,
      rot: rnd() * 360,
    }))
  }, [count, seed])
}

function SnowParticles({ preset }: { preset: (typeof PRESETS)['snow'] }) {
  const particles = useParticles(preset.count, 3)
  return (
    <>
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: 'radial-gradient(circle, #fff 30%, rgba(255,255,255,0.4) 70%, transparent)',
            opacity: 0.85,
            animation: `particle-snow-fall ${p.dur * 2.2}s linear infinite`,
            animationDelay: `${p.delay}s`,
            filter: 'blur(0.4px)',
            pointerEvents: 'none',
            willChange: 'transform',
          }}
        />
      ))}
    </>
  )
}

function EmberParticles({ preset }: { preset: (typeof PRESETS)['ember'] }) {
  const particles = useParticles(preset.count, 5)
  return (
    <>
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size * 0.9,
            height: p.size * 0.9,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${preset.coreColor} 0%, ${preset.color} 40%, ${preset.tailColor} 80%, transparent)`,
            boxShadow: `0 0 ${p.size * 2}px ${preset.color}`,
            animation: `particle-ember-rise ${p.dur * 0.7}s ease-out infinite`,
            animationDelay: `${p.delay}s`,
            pointerEvents: 'none',
            willChange: 'transform, opacity',
          }}
        />
      ))}
    </>
  )
}

function LeafParticles({ preset }: { preset: (typeof PRESETS)['leaf'] }) {
  const particles = useParticles(preset.count, 7)
  return (
    <>
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size * 1.6,
            height: p.size * 0.9,
            background: `linear-gradient(120deg, ${preset.color}, ${preset.secondaryColor})`,
            borderRadius: '50% 10% 50% 10%',
            opacity: 0.85,
            transform: `rotate(${p.rot}deg)`,
            animation: `particle-leaf-fall ${p.dur * 2.2}s ease-in-out infinite`,
            animationDelay: `${p.delay}s`,
            pointerEvents: 'none',
            willChange: 'transform',
          }}
        />
      ))}
    </>
  )
}

function AshParticles({ preset }: { preset: (typeof PRESETS)['ash'] }) {
  const particles = useParticles(preset.count, 11)
  return (
    <>
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size * 0.7,
            height: p.size * 0.7,
            borderRadius: '50%',
            background: preset.color,
            opacity: 0.5,
            animation: `particle-ash-drift ${p.dur * 1.4}s linear infinite`,
            animationDelay: `${p.delay}s`,
            filter: 'blur(0.5px)',
            pointerEvents: 'none',
            willChange: 'transform',
          }}
        />
      ))}
    </>
  )
}

function FireflyParticles({ preset }: { preset: (typeof PRESETS)['firefly'] }) {
  const particles = useParticles(preset.count, 13)
  return (
    <>
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: preset.color,
            boxShadow: `0 0 ${p.size * 3}px ${preset.color}, 0 0 ${p.size * 6}px ${preset.glowColor}`,
            animation: `particle-firefly-float ${p.dur * 1.2}s ease-in-out infinite, particle-firefly-blink ${1.6 + i * 0.13}s ease-in-out infinite`,
            animationDelay: `${p.delay}s, ${-p.delay * 0.5}s`,
            pointerEvents: 'none',
            willChange: 'transform, opacity',
          }}
        />
      ))}
    </>
  )
}

interface BattleParticlesProps {
  arenaId: string
}

export function BattleParticles({ arenaId }: BattleParticlesProps) {
  const biome = ARENA_BIOME[arenaId]
  if (!biome) return null

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ zIndex: 5 }}
      aria-hidden
    >
      {biome === 'snow'    && <SnowParticles    preset={PRESETS.snow} />}
      {biome === 'ember'   && <EmberParticles   preset={PRESETS.ember} />}
      {biome === 'leaf'    && <LeafParticles    preset={PRESETS.leaf} />}
      {biome === 'ash'     && <AshParticles     preset={PRESETS.ash} />}
      {biome === 'firefly' && <FireflyParticles preset={PRESETS.firefly} />}
    </div>
  )
}
