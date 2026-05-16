import { useMemo } from 'react'

type ParticleDepth = 'back' | 'front'

// Arena UUID → biome particle type
const ARENA_BIOME: Record<string, 'leaf' | 'firefly' | 'ash' | 'snow' | 'ember'> = {
  '37543fca-9f22-41c7-83b5-2ded30d7b063': 'leaf',     // Verdantroot Forest
  'ca277fd4-1dd0-4e6e-a50b-c95bbd878395': 'firefly',  // Murkmire Wetlands
  'a353973e-46fe-4757-a90d-a409beddc644': 'ash',      // Ashrock Highlands
  'eae801b3-fac1-4d10-9b40-ea652865c57c': 'snow',     // Frostveil Peaks
  'af76c388-9746-4484-8ab5-bfa9f16349f9': 'ember',    // Sunforge Summit
}

const LEAF_COLOR_PAIRS = [
  { from: '#9bd66a', to: '#5aa840' },
  { from: '#c8d850', to: '#88aa28' },
  { from: '#d4bc38', to: '#a88820' },
  { from: '#74c240', to: '#3a7a1c' },
]

const PRESETS = {
  leaf: { count: 12, seed: 7 },
  firefly: { count: 12, color: '#d8e860', glowColor: '#d8e86080', seed: 13 },
  ash:     { count: 18, color: '#c4b8ad', seed: 11 },
  snow:    { count: 26, color: '#ffffff', seed: 3 },
  ember:   { count: 22, color: '#ffaa3a', coreColor: '#fff5cc', tailColor: '#ff5020', seed: 5 },
}

const DEPTH_PRESETS: Record<ParticleDepth, {
  countScale: number
  sizeScale: number
  durationScale: number
  opacityScale: number
  blurPx: number
}> = {
  back: {
    countScale: 0.82,
    sizeScale: 0.78,
    durationScale: 1.45,
    opacityScale: 0.52,
    blurPx: 0.6,
  },
  front: {
    countScale: 0.45,
    sizeScale: 1.18,
    durationScale: 0.9,
    opacityScale: 0.72,
    blurPx: 0.15,
  },
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

function layerCount(count: number, depth: ParticleDepth): number {
  return Math.max(2, Math.round(count * DEPTH_PRESETS[depth].countScale))
}

function particleStyle(depth: ParticleDepth, baseOpacity: number, baseSize: number) {
  const config = DEPTH_PRESETS[depth]
  return {
    opacity: baseOpacity * config.opacityScale,
    size: baseSize * config.sizeScale,
    durationScale: config.durationScale,
    blurPx: config.blurPx,
  }
}

function SnowParticles({ preset, depth }: { preset: (typeof PRESETS)['snow']; depth: ParticleDepth }) {
  const depthStyle = particleStyle(depth, 0.85, 1)
  const particles = useParticles(layerCount(preset.count, depth), preset.seed + (depth === 'front' ? 30 : 0))
  return (
    <>
      {particles.map((p, i) => {
        const size = p.size * depthStyle.size
        return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: size,
            height: size,
            borderRadius: '50%',
            background: 'radial-gradient(circle, #fff 30%, rgba(255,255,255,0.4) 70%, transparent)',
            opacity: depthStyle.opacity,
            animation: `particle-snow-fall ${p.dur * 2.2 * depthStyle.durationScale}s linear infinite`,
            animationDelay: `${p.delay}s`,
            filter: `blur(${0.4 + depthStyle.blurPx}px)`,
            pointerEvents: 'none',
            willChange: 'transform',
          }}
        />
        )
      })}
    </>
  )
}

function EmberParticles({ preset, depth }: { preset: (typeof PRESETS)['ember']; depth: ParticleDepth }) {
  const depthStyle = particleStyle(depth, 0.9, 1)
  const particles = useParticles(layerCount(preset.count, depth), preset.seed + (depth === 'front' ? 30 : 0))
  return (
    <>
      {particles.map((p, i) => {
        const size = p.size * 0.9 * depthStyle.size
        return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: size,
            height: size,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${preset.coreColor} 0%, ${preset.color} 40%, ${preset.tailColor} 80%, transparent)`,
            boxShadow: `0 0 ${size * 2}px ${preset.color}`,
            opacity: depthStyle.opacity,
            filter: `blur(${depthStyle.blurPx}px)`,
            animation: `particle-ember-rise ${p.dur * 0.7 * depthStyle.durationScale}s ease-out infinite`,
            animationDelay: `${p.delay}s`,
            pointerEvents: 'none',
            willChange: 'transform, opacity',
          }}
        />
        )
      })}
    </>
  )
}

function LeafParticles({ preset, depth }: { preset: (typeof PRESETS)['leaf']; depth: ParticleDepth }) {
  const depthStyle = particleStyle(depth, 1.0, 1)
  const seed = preset.seed + (depth === 'front' ? 30 : 0)
  const particles = useParticles(layerCount(preset.count, depth), seed)

  const leafData = useMemo(() => {
    const colorRnd = seededRandom(seed + 100)
    const yRnd = seededRandom(seed + 200)
    return particles.map((p) => {
      const totalDur = p.dur * 2.2 * depthStyle.durationScale
      return {
        colorIdx: Math.floor(colorRnd() * LEAF_COLOR_PAIRS.length),
        startY: -(yRnd() * 8),
        delay: -(Math.abs(p.delay) / 12) * totalDur,
        totalDur,
      }
    })
  }, [particles, seed, depthStyle.durationScale])

  return (
    <>
      {particles.map((p, i) => {
        const width = p.size * 2.5 * depthStyle.size
        const height = p.size * 1.0 * depthStyle.size
        const { from, to } = LEAF_COLOR_PAIRS[leafData[i].colorIdx]
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${p.x}%`,
              top: `${leafData[i].startY}%`,
              width,
              height,
              background: `linear-gradient(120deg, ${from}, ${to})`,
              borderRadius: '60% 40% 60% 40% / 80% 60% 80% 60%',
              opacity: depthStyle.opacity,
              transform: `rotate(${p.rot}deg)`,
              filter: `blur(${depthStyle.blurPx}px)`,
              animation: `particle-leaf-fall ${leafData[i].totalDur}s linear infinite`,
              animationDelay: `${leafData[i].delay}s`,
              pointerEvents: 'none',
              willChange: 'transform',
            }}
          />
        )
      })}
    </>
  )
}

function AshParticles({ preset, depth }: { preset: (typeof PRESETS)['ash']; depth: ParticleDepth }) {
  const depthStyle = particleStyle(depth, 0.5, 1)
  const particles = useParticles(layerCount(preset.count, depth), preset.seed + (depth === 'front' ? 30 : 0))
  return (
    <>
      {particles.map((p, i) => {
        const size = p.size * 0.7 * depthStyle.size
        return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: size,
            height: size,
            borderRadius: '50%',
            background: preset.color,
            opacity: depthStyle.opacity,
            animation: `particle-ash-drift ${p.dur * 1.4 * depthStyle.durationScale}s linear infinite`,
            animationDelay: `${p.delay}s`,
            filter: `blur(${0.5 + depthStyle.blurPx}px)`,
            pointerEvents: 'none',
            willChange: 'transform',
          }}
        />
        )
      })}
    </>
  )
}

function FireflyParticles({ preset, depth }: { preset: (typeof PRESETS)['firefly']; depth: ParticleDepth }) {
  const depthStyle = particleStyle(depth, 0.9, 1)
  const particles = useParticles(layerCount(preset.count, depth), preset.seed + (depth === 'front' ? 30 : 0))
  return (
    <>
      {particles.map((p, i) => {
        const size = p.size * depthStyle.size
        return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: size,
            height: size,
            borderRadius: '50%',
            background: preset.color,
            boxShadow: `0 0 ${size * 3}px ${preset.color}, 0 0 ${size * 6}px ${preset.glowColor}`,
            opacity: depthStyle.opacity,
            filter: `blur(${depthStyle.blurPx}px)`,
            animation: `particle-firefly-float ${p.dur * 1.2 * depthStyle.durationScale}s ease-in-out infinite, particle-firefly-blink ${1.6 + i * 0.13}s ease-in-out infinite`,
            animationDelay: `${p.delay}s, ${-p.delay * 0.5}s`,
            pointerEvents: 'none',
            willChange: 'transform, opacity',
          }}
        />
        )
      })}
    </>
  )
}

interface BattleParticlesProps {
  arenaId: string
}

function BiomeParticles({ biome, depth }: { biome: keyof typeof PRESETS; depth: ParticleDepth }) {
  return (
    <>
      {biome === 'snow'    && <SnowParticles    preset={PRESETS.snow} depth={depth} />}
      {biome === 'ember'   && <EmberParticles   preset={PRESETS.ember} depth={depth} />}
      {biome === 'leaf'    && <LeafParticles    preset={PRESETS.leaf} depth={depth} />}
      {biome === 'ash'     && <AshParticles     preset={PRESETS.ash} depth={depth} />}
      {biome === 'firefly' && <FireflyParticles preset={PRESETS.firefly} depth={depth} />}
    </>
  )
}

export function BattleParticles({ arenaId }: BattleParticlesProps) {
  const biome = ARENA_BIOME[arenaId]
  if (!biome) return null

  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        data-testid="battle-particles-back"
        style={{
          zIndex: 0,
        }}
        aria-hidden
      >
        <BiomeParticles biome={biome} depth="back" />
      </div>
      <div
        className="pointer-events-none absolute left-0 right-0 overflow-hidden"
        data-testid="battle-particles-front"
        style={{
          top: '5rem',
          bottom: '10rem',
          zIndex: 5,
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 14%, black 80%, transparent 100%)',
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 14%, black 80%, transparent 100%)',
        }}
        aria-hidden
      >
        <BiomeParticles biome={biome} depth="front" />
      </div>
    </>
  )
}
