import { useEffect, useState } from 'react'

// ── Colour helpers ────────────────────────────────────────────────────────────

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

/** Clamp a value to [0, 1] */
function clampF(v: number) { return Math.max(0, Math.min(1, v)) }

/** Linear interpolation */
function lerp(a: number, b: number, t: number) { return a + (b - a) * t }

/**
 * Lerp hue toward a target, always taking the short way around the colour wheel.
 * t=0 → from, t=1 → to.
 */
function lerpHue(from: number, to: number, t: number): number {
  let diff = to - from
  if (diff > 180)  diff -= 360
  if (diff < -180) diff += 360
  return (from + diff * t + 360) % 360
}

// Sky hue used to pull the top zone. ~210° is a natural daylight blue/cyan.
const SKY_HUE = 210

/**
 * Build an hsl() stop.
 * @param skyT  0–1 lerp factor toward SKY_HUE (top zone only; 0 in bottom zone)
 * @param ds    Saturation delta (−1 to +1)
 * @param dl    Lightness delta (−1 to +1)
 */
function buildStep(h: number, s: number, l: number, skyT: number, ds: number, dl: number): string {
  const finalH = skyT > 0 ? lerpHue(h, SKY_HUE, skyT) : h
  const finalS = clampF(s + ds)
  const finalL = clampF(l + dl)
  return `hsl(${Math.round(finalH)},${Math.round(finalS * 100)}%,${Math.round(finalL * 100)}%)`
}

// ── Gradient builder ──────────────────────────────────────────────────────────

// Number of bands per zone. 8+8 = 16 total → ~25px per band on a 400px arena.
const BANDS_PER_ZONE = 8

/** Format a percentage stop cleanly (no trailing zeros). */
function pct(i: number): string {
  const v = i * 50 / BANDS_PER_ZONE
  return `${parseFloat(v.toFixed(2))}%`
}

/**
 * Derives a GBA-style stepped background from the sampled terrain colour.
 *
 * Top zone (0–50%): sky — hue lerps toward daylight blue, lightens, desaturates.
 * Bottom zone (50–100%): ground — stays terrain hue, darkens, slightly saturates.
 *
 * Hard edges: each colour is repeated at its adjacent stop boundary.
 * Values computed via lerp so the only tuning knobs are the range endpoints.
 */
function deriveCss(r: number, g: number, b: number): string {
  const [h, s, l] = rgbToHsl(r, g, b)
  const N = BANDS_PER_ZONE

  const bands: [string, string, string][] = []

  // Top zone — sky. t=1 at the very top, t=0 at the horizon.
  for (let i = 0; i < N; i++) {
    const t = (N - 1 - i) / (N - 1)  // 1 → 0 as we go top → horizon
    const color = buildStep(
      h, s, l,
      lerp(0.02, 0.82, t),   // sky hue lerp: barely shifts near horizon, strongly at top
      lerp(0,   -0.18, t),   // desaturate toward top
      lerp(0.02, +0.40, t),  // lighten toward top
    )
    bands.push([color, pct(i), pct(i + 1)])
  }

  // Bottom zone — ground. t=0 at the horizon, t=1 at the very bottom.
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1)  // 0 → 1 as we go horizon → bottom
    const color = buildStep(
      h, s, l,
      0,                     // no sky shift in ground zone
      lerp(0.04, +0.13, t), // saturate toward bottom
      lerp(-0.06, -0.46, t), // darken toward bottom
    )
    bands.push([color, pct(N + i), pct(N + i + 1)])
  }

  const stops = bands.flatMap(([color, from, to]) => [`${color} ${from}`, `${color} ${to}`])
  return `linear-gradient(to bottom, ${stops.join(', ')})`
}

// Fallback: arena_1 mid-green, computed through the same algorithm.
const DEFAULT_BG = deriveCss(106, 170, 48)

// ── Sampling region ───────────────────────────────────────────────────────────
// Spec-calibrated sampling region — upper-right of oval, reliably opaque grass pixels.
// Coordinates are fractions of the 512×240 canvas.
const SAMPLE = { x: 0.68, y: 0.08, w: 0.19, h: 0.25 } // ~(350,20)→(450,80) in native px

async function samplePlatform(url: string): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload  = () => resolve(el)
    el.onerror = reject
    el.src = url
  })

  const canvas = document.createElement('canvas')
  canvas.width  = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return DEFAULT_BG

  ctx.drawImage(img, 0, 0)

  const sx = Math.round(SAMPLE.x * img.naturalWidth)
  const sy = Math.round(SAMPLE.y * img.naturalHeight)
  const sw = Math.round(SAMPLE.w * img.naturalWidth)
  const sh = Math.round(SAMPLE.h * img.naturalHeight)

  const { data } = ctx.getImageData(sx, sy, sw, sh)
  let r = 0, g = 0, b = 0, n = 0
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 128) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n++ }
  }
  if (n === 0) return DEFAULT_BG

  return deriveCss(Math.round(r / n), Math.round(g / n), Math.round(b / n))
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Derives the arena background by sampling the dominant terrain colour from the
 * player platform image and building a GBA-style stepped sky/ground gradient.
 * Falls back to the default green gradient if image loading or sampling fails.
 */
export function useTerrainBackground(playerPlatformUrl: string | null): string {
  const [sampledBg, setSampledBg] = useState<{ url: string; css: string } | null>(null)

  useEffect(() => {
    if (!playerPlatformUrl) return
    let cancelled = false
    samplePlatform(playerPlatformUrl)
      .then((css) => {
        if (!cancelled) setSampledBg({ url: playerPlatformUrl, css })
      })
      .catch(() => {
        if (!cancelled) setSampledBg({ url: playerPlatformUrl, css: DEFAULT_BG })
      })
    return () => { cancelled = true }
  }, [playerPlatformUrl])

  return playerPlatformUrl && sampledBg?.url === playerPlatformUrl ? sampledBg.css : DEFAULT_BG
}
