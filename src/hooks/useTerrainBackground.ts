import { useEffect, useState } from 'react'

const DEFAULT_BG = 'linear-gradient(to bottom, #c8dba0 0%, #6aaa30 50%, #3d8018 100%)'

// Spec-calibrated sampling region — upper-right of oval, reliably opaque grass pixels.
// Coordinates are fractions of the 512×240 canvas.
const SAMPLE = { x: 0.68, y: 0.08, w: 0.19, h: 0.25 } // ~(350,20)→(450,80) in native px

function clamp(v: number) { return Math.max(0, Math.min(255, Math.round(v))) }

function shift(r: number, g: number, b: number, amount: number) {
  return `rgb(${clamp(r + amount)},${clamp(g + amount)},${clamp(b + amount)})`
}

function deriveCss(r: number, g: number, b: number) {
  return [
    `linear-gradient(to bottom,`,
    `  ${shift(r, g, b, +55)} 0%,`,
    `  ${shift(r, g, b, +20)} 40%,`,
    `  rgb(${r},${g},${b}) 70%,`,
    `  ${shift(r, g, b, -25)} 100%)`,
  ].join('\n')
}

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

/**
 * Derives the arena background gradient by sampling the dominant terrain colour
 * from the player platform image. Falls back to the default green gradient if
 * the image hasn't loaded or sampling fails.
 */
export function useTerrainBackground(playerPlatformUrl: string | null): string {
  const [bg, setBg] = useState(DEFAULT_BG)

  useEffect(() => {
    if (!playerPlatformUrl) { setBg(DEFAULT_BG); return }
    let cancelled = false
    samplePlatform(playerPlatformUrl)
      .then(css => { if (!cancelled) setBg(css) })
      .catch(() => { if (!cancelled) setBg(DEFAULT_BG) })
    return () => { cancelled = true }
  }, [playerPlatformUrl])

  return bg
}
