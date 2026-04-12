// ── Arena accent palette derivation ──────────────────────────────────────────
// Pure sync utility — no React, no side effects.
//
// Takes a single pre-baked accent hex per arena and derives four CSS custom
// properties that can be injected onto any wrapper element. Descendants
// consume var(--arena-accent) etc. without needing props threaded through.
//
// Injection points:
//   • ArenaCard <button>     → --arena-accent only (hub; one card = one accent)
//   • ArenaDetailPage root   → full palette (single arena in view)

const FALLBACK_HEX = '#6aaa30'

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return null
  const n = parseInt(clean, 16)
  if (isNaN(n)) return null
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === rn)      h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
  else if (max === gn) h = ((bn - rn) / d + 2) / 6
  else                 h = ((rn - gn) / d + 4) / 6
  return [h * 360, s, l]
}

function clamp(v: number, lo = 0, hi = 1) { return Math.max(lo, Math.min(hi, v)) }

function hsl(h: number, s: number, l: number): string {
  return `hsl(${Math.round(h)}, ${Math.round(clamp(s) * 100)}%, ${Math.round(clamp(l) * 100)}%)`
}

// ── Terrain gradient derivation (synchronous, from hex) ──────────────────────
// Mirrors the GBA-style band algorithm in useTerrainBackground.ts but derives
// from accentHex rather than sampling a platform image. Used for hub cards
// where multiple gradients are needed synchronously without canvas work.

const SKY_HUE = 210
const BANDS = 8

function lerpN(a: number, b: number, t: number) { return a + (b - a) * t }

function lerpHue(from: number, to: number, t: number): number {
  let diff = to - from
  if (diff > 180)  diff -= 360
  if (diff < -180) diff += 360
  return (from + diff * t + 360) % 360
}

function pct(i: number): string {
  const v = i * 50 / BANDS
  return `${parseFloat(v.toFixed(2))}%`
}

function band(h: number, s: number, l: number, skyT: number, ds: number, dl: number): string {
  const fh = skyT > 0 ? lerpHue(h, SKY_HUE, skyT) : h
  return `hsl(${Math.round(fh)},${Math.round(clamp(s + ds) * 100)}%,${Math.round(clamp(l + dl) * 100)}%)`
}

/**
 * Derives the same GBA-style stepped sky/ground gradient used in the battle
 * arena background, but synchronously from a hex accent colour.
 */
export function deriveTerrainGradient(accentHex: string = FALLBACK_HEX): string {
  const rgb = hexToRgb(accentHex) ?? hexToRgb(FALLBACK_HEX)!
  const [h, s, l] = rgbToHsl(...rgb)
  const N = BANDS
  const stops: string[] = []

  for (let i = 0; i < N; i++) {
    const t = (N - 1 - i) / (N - 1)
    const c = band(h, s, l, lerpN(0.02, 0.82, t), lerpN(0, -0.18, t), lerpN(0.02, 0.40, t))
    stops.push(`${c} ${pct(i)}`, `${c} ${pct(i + 1)}`)
  }
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1)
    const c = band(h, s, l, 0, lerpN(0.04, 0.13, t), lerpN(-0.06, -0.46, t))
    stops.push(`${c} ${pct(N + i)}`, `${c} ${pct(N + i + 1)}`)
  }

  return `linear-gradient(to bottom, ${stops.join(', ')})`
}

// ── Accent palette ────────────────────────────────────────────────────────────

export interface ArenaAccentVars {
  '--arena-accent': string
  '--arena-accent-muted': string
  '--arena-surface': string
  '--arena-on-accent': string
}

/**
 * Derives a four-variable CSS custom property palette from a single accent hex.
 *
 * --arena-accent        The base accent (strip, progress bar fill, active borders)
 * --arena-accent-muted  Lighter, desaturated — section borders, subtle dividers
 * --arena-surface       Near-white tint — card background washes
 * --arena-on-accent     High-contrast text colour on the accent (white or dark)
 */
export function deriveAccentVars(accentHex: string = FALLBACK_HEX): ArenaAccentVars {
  const rgb = hexToRgb(accentHex) ?? hexToRgb(FALLBACK_HEX)!
  const [h, s, l] = rgbToHsl(...rgb)

  return {
    '--arena-accent':       accentHex,
    '--arena-accent-muted': hsl(h, s * 0.75, clamp(l + 0.15)),
    '--arena-surface':      hsl(h, s * 0.18, clamp(l + 0.42)),
    '--arena-on-accent':    l < 0.55 ? '#ffffff' : '#0F172A',
  }
}
