import { DEFAULT_WORLD_MAP_LAYOUT, WORLD_MAP_EDGE_PAD_FRACTION } from './worldMapLayout'
import type { WorldMapLayout } from './worldMapLayout'

export interface NodePosition {
  x: number
  y: number
}

/** Minimal shape required for position resolution — accepts ArenaListArena or WorldMapOpponentNode. */
interface MapNode {
  mapX: number | null
  mapY: number | null
}

/** Center-to-side route pattern with a mild rightward climb after the first side step. */
const X_PATTERN = [0.50, 0.30, 0.58, 0.70, 0.50, 0.30]

/** 5-step winding pattern used when nodes are grouped into biomes of 5.
 *  Node 0 (biome entry) and node 4 (boss) are near center so cross-biome
 *  path segments stay roughly vertical. */
const X_PATTERN_5 = [0.50, 0.25, 0.50, 0.80, 0.60]

// ── Per-biome node position overrides ────────────────────────────────────────
// Key: arenaSortOrder (1–5).
// Value: 5-element array indexed by posInBiome (0 = biome entry / bottom, 4 = boss / top).
// Each entry is { x, y } as fractions of layout.width / layout.height (0–1).
// Set a slot to null to fall back to the computed position for that node.
// Leave a biome's key absent to use the computed layout for the whole biome.
//
// To tune: open the world map in the browser, note where a node lands vs. where
// the terrain feature is, adjust x/y by ±0.02–0.05 and save — HMR updates instantly.
//
// Arena sort order → biome name:
//   1 = Verdantroot Forest   2 = Murkmire Wetlands   3 = Ashrock Highlands
//   4 = Frostveil Peaks      5 = Sunforge Summit
const BIOME_NODE_POSITIONS: Partial<Record<number, ReadonlyArray<{ x: number; y: number } | null>>> = {
  // Example — uncomment and fill to override a biome:
  1: [
    { x: 0.50, y: 0.94 },  // posInBiome 0 — Bramblin
    { x: 0.25, y: 0.90 },  // posInBiome 1 — Mushbob
    { x: 0.50, y: 0.86 },  // posInBiome 2 — Mossboar
    { x: 0.80, y: 0.82 },  // posInBiome 3 — Thornfang
    { x: 0.58, y: 0.78 },  // posInBiome 4 — Elderhorn (boss)
  ],
  2: [
    { x: 0.83, y: 0.73 },  // posInBiome 0 — Boglet
    { x: 0.68, y: 0.675 },  // posInBiome 1 — Mudmaul
    { x: 0.35, y: 0.67 },  // posInBiome 2 — Reedstalker
    { x: 0.60, y: 0.62 },  // posInBiome 3 — Mirewidow
    { x: 0.72, y: 0.57 },  // posInBiome 4 — Leviamire (boss)
  ],
  3: [
    { x: 0.74, y: 0.52 },  // posInBiome 0 — Pebblit
    { x: 0.42, y: 0.51 },  // posInBiome 1 — Screechmite
    { x: 0.18, y: 0.48 },  // posInBiome 2 — Flintor
    { x: 0.24, y: 0.44 },  // posInBiome 3 — Shockmantis
    { x: 0.50, y: 0.41 },  // posInBiome 4 — Thunderox (boss)
  ],
  4: [
    { x: 0.55, y: 0.36 },  // posInBiome 0 — Frostscarab
    { x: 0.46, y: 0.32 },  // posInBiome 1 — Glaciowyrm
    { x: 0.80, y: 0.30 },  // posInBiome 2 — Glaciermaw
    { x: 0.80, y: 0.25 },  // posInBiome 3 — Frostwraith
    { x: 0.58, y: 0.23 },  // posInBiome 4 — Tuskraal (boss)
  ],
  5: [
    { x: 0.55, y: 0.19 },  // posInBiome 0 — Pyrobeetle
    { x: 0.85, y: 0.158 },  // posInBiome 1 — Magmacrab
    { x: 0.78, y: 0.11 },  // posInBiome 2 — Ashraptor
    { x: 0.45, y: 0.08 },  // posInBiome 3 — Cindershell
    { x: 0.22, y: 0.04 },  // posInBiome 4 — Solgryth (boss)
  ],
}

export function resolveNodePosition(
  node: MapNode,
  index: number,
  total: number,
  layout: WorldMapLayout = DEFAULT_WORLD_MAP_LAYOUT,
  groupSize?: number,
): NodePosition {
  if (node.mapX !== null && node.mapY !== null) {
    return { x: node.mapX * layout.width, y: node.mapY * layout.height }
  }

  const sideGutter = 58 * layout.nodeScale

  if (groupSize && groupSize > 1) {
    const biomeCount = Math.ceil(total / groupSize)
    const biomeIndex = Math.floor(index / groupSize)
    const posInBiome = index % groupSize
    const actualGroupSize = Math.min(groupSize, total - biomeIndex * groupSize)

    // Per-biome override — checked before falling through to the computed layout.
    const override = BIOME_NODE_POSITIONS[biomeIndex + 1]?.[posInBiome]
    if (override) {
      return { x: override.x * layout.width, y: override.y * layout.height }
    }

    const edgePad = layout.height * WORLD_MAP_EDGE_PAD_FRACTION
    const usableHeight = layout.height - edgePad * 2
    const biomeH = usableHeight / biomeCount
    const biomePad = biomeH * 0.10
    const biomeBottom = layout.height - edgePad - biomeIndex * biomeH
    const biomeSpan = biomeH - biomePad * 2

    // posInBiome 0 = bottom of biome, top = boss
    const y = biomeBottom - biomePad - (posInBiome / Math.max(actualGroupSize - 1, 1)) * biomeSpan

    const rawX = layout.width * (X_PATTERN_5[posInBiome % X_PATTERN_5.length] ?? 0.5)
    const x = Math.min(Math.max(rawX, sideGutter), layout.width - sideGutter)
    return { x, y }
  }

  const margin = Math.max(layout.height * 0.07, 50 * layout.nodeScale)
  const span = layout.height - margin * 2
  // index 0 = bottom, index N-1 = top
  const y = layout.height - margin - (index / Math.max(total - 1, 1)) * span
  const rawX = layout.width * (X_PATTERN[index % X_PATTERN.length] ?? 0.5)
  const x = Math.min(Math.max(rawX, sideGutter), layout.width - sideGutter)
  return { x, y }
}
