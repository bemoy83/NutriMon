/**
 * Pure-CSS atmosphere layer for the battle arena — no art required.
 * Placed as a sibling of BattleParticles inside arenaRef.
 *
 * To remove all dressing: delete this file and remove the one
 * <BattleArenaDressing /> line from BattlePage.tsx.
 *
 * Individual effects are toggled by commenting out their div blocks below.
 */

interface BattleArenaDressingProps {
  /** Hex accent from terrain registry, e.g. '#6aaa30'. Falls back to forest green. */
  accentColor?: string
  /** Player HP as a fraction 0–1. Danger vignette activates at ≤ 0.25. */
  playerHpPct?: number
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `${isNaN(r) ? 106 : r},${isNaN(g) ? 170 : g},${isNaN(b) ? 48 : b}`
}

export function BattleArenaDressing({
  accentColor = '#6aaa30',
  playerHpPct = 1,
}: BattleArenaDressingProps) {
  const rgb = hexToRgb(accentColor)
  const isDanger = playerHpPct <= 0.25

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>

      {/* ── Ground bloom ──────────────────────────────────────────────────────
          Arena-tinted glow rising from the base. Two layers: a wide spread for
          the overall ground hue, and a tighter core for the floor contact zone.
          z-2: behind particles (z-5) and sprites (z-1…z-4 in Zone 2). */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '55%',
          background: `radial-gradient(ellipse 90% 100% at 50% 100%, rgba(${rgb},0.38) 0%, rgba(${rgb},0.12) 55%, transparent 75%)`,
          zIndex: 2,
        }}
      />

      {/* ── Vignette ──────────────────────────────────────────────────────────
          Darkens the corners and edges to frame the battlefield. Four stops
          instead of two so the falloff is gradual — no visible ring.
          The ellipse is 160% wide so the left/right screen edges stay inside the
          gradient zone (never hit the hard 100% cap), and 110% tall so darkness
          feathers all the way to the bottom of the arena.
          z-6: above particles (z-5) so the framing covers everything. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 160% 110% at 50% 48%, transparent 38%, rgba(0,0,0,0.18) 58%, rgba(0,0,0,0.38) 78%, rgba(0,0,0,0.52) 100%)',
          zIndex: 6,
        }}
      />

      {/* ── Danger vignette ───────────────────────────────────────────────────
          Slow heartbeat pulse (1.6s) from the arena edges when player HP ≤ 25%.
          Radial gradient leaves the centre clear so sprites stay readable.
          z-8: above vignette (z-6) and scanlines (z-7), below HUD (z-10). */}
      {isDanger && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse 140% 120% at 50% 50%, transparent 35%, rgba(220,38,38,0.62) 80%, rgba(185,28,28,0.82) 100%)',
            animation: 'battle-danger-pulse 1.4s ease-in-out infinite',
            zIndex: 8,
          }}
        />
      )}

      {/* ── Scanlines ─────────────────────────────────────────────────────────
          2.5% opacity repeating lines at 3 px pitch. Barely perceptible but
          adds a CRT/GBA texture that coheres with the pixel-art sprites.
          z-7: above vignette, below HUD cards (z-10) and command bar (z-30). */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'repeating-linear-gradient(to bottom, rgba(0,0,0,0.025) 0px, rgba(0,0,0,0.025) 1px, transparent 1px, transparent 3px)',
          zIndex: 7,
        }}
      />

    </div>
  )
}
