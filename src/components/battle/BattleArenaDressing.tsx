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
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `${isNaN(r) ? 106 : r},${isNaN(g) ? 170 : g},${isNaN(b) ? 48 : b}`
}

export function BattleArenaDressing({ accentColor = '#6aaa30' }: BattleArenaDressingProps) {
  const rgb = hexToRgb(accentColor)

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>

      {/* ── Ground bloom ──────────────────────────────────────────────────────
          Soft arena-tinted glow rising from the bottom half. Gives the ground
          colour and depth — reads as ambient light bouncing off the terrain.
          z-2: behind particles (z-5) and sprites (z-1…z-4 in Zone 2). */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '50%',
          background: `radial-gradient(ellipse 80% 100% at 50% 100%, rgba(${rgb},0.20) 0%, transparent 70%)`,
          zIndex: 2,
        }}
      />

      {/* ── Horizon line ──────────────────────────────────────────────────────
          Thin glowing accent at exactly 50% of arenaRef height — matches the
          sky-to-ground boundary in the stepped gradient from useTerrainBackground.
          z-2: decorative, sits behind sprites. */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          right: 0,
          height: 1,
          background: `rgba(${rgb},0.45)`,
          boxShadow: `0 0 8px 2px rgba(${rgb},0.25), 0 0 22px 6px rgba(${rgb},0.10)`,
          zIndex: 2,
        }}
      />

      {/* ── Vignette ──────────────────────────────────────────────────────────
          Darkens the corners and edges to frame the battlefield. The ellipse is
          intentionally wide (150% of container width) so the transparent centre
          covers most of the sprite area — only the outermost sprite edges get a
          ~8–16% tint, which helps blend them into the scene.
          z-6: above particles (z-5) so the framing covers everything. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 150% 90% at 50% 45%, transparent 50%, rgba(0,0,0,0.52) 100%)',
          zIndex: 6,
        }}
      />

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
