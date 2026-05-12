// Sprite registry — single source of truth for all creature/opponent sprite URLs.
// Returns null for unregistered keys so components can render a fallback.
// To add a sprite: drop the PNG into public/sprites/, add an entry below.

// Vite's BASE_URL handles the /NutriMon/ prefix in production and dev.
// Strips trailing slash so we can write `${base}/sprites/...` cleanly.
const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')

function s(path: string): string {
  return `${base}${path}`
}

export function getPublicAssetUrl(path: string): string {
  return s(path)
}

export interface SpriteDescriptor {
  url: string
  nativeWidth: number
  nativeHeight: number
  /** Direction the art faces in the source file */
  facing: 'right' | 'left'
  /** true for pixel art (applies pixelated rendering). false/omitted for smooth illustrations. */
  pixelArt?: boolean
}

export interface AnimationDescriptor {
  /** Phase 1: individual frame URLs in order */
  frames: string[]
  fps: number
  // Phase 2 (non-breaking additions):
  // sheet?: string
  // frameWidth?: number
  // frameCount?: number
}

// ── Player sprite registry ───────────────────────────────────────────────────
// Key format: `${stage}_${condition}`
const PLAYER_SPRITES: Partial<Record<string, SpriteDescriptor>> = {
  // Uncomment + add PNG to public/sprites/player/ to activate:
  'baby_steady': { url: s('/sprites/player/baby_steady.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
  'baby_thriving': { url: s('/sprites/player/baby_thriving.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
  'baby_recovering': { url: s('/sprites/player/baby_recovering.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
  // 'adult_steady':       { url: s('/sprites/player/adult_steady.png'),       nativeWidth: 256, nativeHeight: 256, facing: 'right' },
  // 'adult_thriving':     { url: s('/sprites/player/adult_thriving.png'),     nativeWidth: 256, nativeHeight: 256, facing: 'right' },
  // 'adult_recovering':   { url: s('/sprites/player/adult_recovering.png'),   nativeWidth: 256, nativeHeight: 256, facing: 'right' },
  // 'champion_steady':    { url: s('/sprites/player/champion_steady.png'),    nativeWidth: 256, nativeHeight: 256, facing: 'right' },
  // 'champion_thriving':  { url: s('/sprites/player/champion_thriving.png'),  nativeWidth: 256, nativeHeight: 256, facing: 'right' },
  // 'champion_recovering':{ url: s('/sprites/player/champion_recovering.png'),nativeWidth: 256, nativeHeight: 256, facing: 'right' },
}

// ── Player battle sprite registry ───────────────────────────────────────────
// Side-profile sprites used in the battle arena (distinct from front-facing page sprites).
// Key format: `${stage}_${condition}`
const PLAYER_BATTLE_SPRITES: Partial<Record<string, SpriteDescriptor>> = {
  'baby_steady': { url: s('/sprites/player_battle/baby_steady.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
  // 'baby_thriving':       { url: s('/sprites/player_battle/baby_thriving.png'),       nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: false },
  // 'baby_recovering': { url: s('/sprites/player_battle/baby_recovering.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
  // 'adult_steady':        { url: s('/sprites/player_battle/adult_steady.png'),        nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: false },
  // 'adult_thriving':      { url: s('/sprites/player_battle/adult_thriving.png'),      nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: false },
  // 'adult_recovering':    { url: s('/sprites/player_battle/adult_recovering.png'),    nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: false },
  // 'champion_steady':     { url: s('/sprites/player_battle/champion_steady.png'),     nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: false },
  // 'champion_thriving':   { url: s('/sprites/player_battle/champion_thriving.png'),   nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: false },
  // 'champion_recovering': { url: s('/sprites/player_battle/champion_recovering.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: false },
}

// ── Hit impact registry ──────────────────────────────────────────────────────
// Drop a PNG into public/sprites/effects/ and set the URL below.
// null = no impact PNG registered yet (showHitImpact() becomes a no-op).
const HIT_IMPACT_URL: string | null = s('/sprites/effects/hit_impact.png')

/** Returns the hit impact PNG URL, or null if none is registered. */
export function getHitImpactUrl(): string | null {
  return HIT_IMPACT_URL
}

// ── Player world map sprite registry ────────────────────────────────────────
// Distinct from battle sprites — overhead/isometric style for the world map.
// Falls back to PLAYER_BATTLE_SPRITES when not registered.
// Key format: `${stage}_${condition}`
const PLAYER_WORLD_MAP_SPRITES: Partial<Record<string, SpriteDescriptor>> = {
  // Uncomment + add PNG to public/sprites/player_world/ to activate:
  'baby_steady': { url: s('/sprites/player_world/baby_steady.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
  // 'baby_thriving':   { url: s('/sprites/player_world/baby_thriving.png'),   nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
  // 'baby_recovering': { url: s('/sprites/player_world/baby_recovering.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
  // 'adult_steady':    { url: s('/sprites/player_world/adult_steady.png'),    nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
  // 'adult_thriving':  { url: s('/sprites/player_world/adult_thriving.png'),  nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
  // 'adult_recovering':{ url: s('/sprites/player_world/adult_recovering.png'),nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
}

// ── Opponent sprite registry ─────────────────────────────────────────────────
// Key format: slugified opponent name e.g. "Pebble Pup" → "pebble_pup"
// `worldMap` — optional world-map variant; falls back to `battle` when absent.
// `icon` — optional turn-order/timeline portrait; falls back to initials when absent.
// `recovering` is optional — omit it and the sprite stays fainted after defeat.
// `footOffsetX` — horizontal offset in NATIVE pixels (256px canvas) from the
//   canvas centre to where the creature's feet actually stand. Positive = feet
//   are to the right of canvas centre. The renderer converts to display pixels
//   automatically. Set this when a creature's stance is off-centre in the PNG.
// `footOffsetY` — vertical offset in NATIVE pixels from the canvas bottom to
//   where the creature's feet actually land. Positive = feet are higher in the
//   canvas (platform moves up); negative = feet are lower (platform moves down).
//   Use this when a creature floats or is grounded above/below the canvas edge.
interface OpponentSpriteEntry {
  battle: SpriteDescriptor
  worldMap?: SpriteDescriptor
  icon?: SpriteDescriptor
  // recovering?: SpriteDescriptor
  footOffsetX?: number
  footOffsetY?: number
}

// ── Worldspire Dex — Opponent sprite registry ────────────────────────────────
// 25 creatures across 5 biomes. All entries are commented out pending art delivery.
// To activate a sprite:
//   1. Drop the PNG into public/sprites/opponents/
//   2. Uncomment the entry and confirm nativeWidth / nativeHeight match the PNG.
//   3. All opponent battle and world-map sprites are 256×256 pixel art.
//   4. Tune footOffsetX if the creature's stance is off-centre in the PNG.
//   5. Add optional worldMap/icon variants in the same creature entry.
//
// Slug convention: lowercase, spaces → underscores (matches slugify() below).
const OPPONENT_SPRITES: Partial<Record<string, OpponentSpriteEntry>> = {

  // ── Arena 1 — Verdantroot Forest (levels 1–5) ─────────────────────────────

  // 001 Bramblin — small — prickly defender (leaf-ball hedgehog)
  'bramblin': {
    battle: { url: s('/sprites/opponents/bramblin.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
    worldMap: { url: s('/sprites/opponents_world/bramblin.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
    icon: { url: s('/sprites/icons/bramblin.png'), nativeWidth: 64, nativeHeight: 64, facing: 'right', pixelArt: true },
  },

  // 002 Mushbob — small — unstable brawler (lopsided mushroom cap)
  'mushbob': {
    battle: { url: s('/sprites/opponents/mushbob.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
    worldMap: { url: s('/sprites/opponents_world/mushbob.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
    icon: { url: s('/sprites/icons/mushbob.png'), nativeWidth: 64, nativeHeight: 64, facing: 'right', pixelArt: true },
  },

  // 003 Mossboar — medium — heavy charger (moss ridge + tusks)
  'mossboar': {
    battle: { url: s('/sprites/opponents/mossboar.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
    worldMap: { url: s('/sprites/opponents_world/mossboar.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
    icon: { url: s('/sprites/icons/mossboar.png'), nativeWidth: 64, nativeHeight: 64, facing: 'right', pixelArt: true },
  },

  // 004 Thornfang — medium — quick predator (raised shoulder ridge)
  'thornfang': {
    battle: { url: s('/sprites/opponents/thornfang.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
    worldMap: { url: s('/sprites/opponents_world/thornfang.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
    icon: { url: s('/sprites/icons/thornfang.png'), nativeWidth: 64, nativeHeight: 64, facing: 'right', pixelArt: true },
  },

  // 005 Elderhorn — large (BOSS) — ancient forest guardian (antler crown)
  'elderhorn': {
    battle: { url: s('/sprites/opponents/elderhorn.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
    worldMap: { url: s('/sprites/opponents_world/elderhorn.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
    icon: { url: s('/sprites/icons/elderhorn.png'), nativeWidth: 64, nativeHeight: 64, facing: 'right', pixelArt: true },
  },

  // ── Arena 2 — Murkmire Wetlands (levels 6–11) ─────────────────────────────

  // 006 Boglet — small — gaping ambusher (circle with huge mouth)
  'boglet': {
    battle: { url: s('/sprites/opponents/boglet.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
    worldMap: { url: s('/sprites/opponents_world/boglet.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
    icon: { url: s('/sprites/icons/boglet.png'), nativeWidth: 64, nativeHeight: 64, facing: 'right', pixelArt: true },
  },

  // 007 Mudmaul — medium — armoured bulldozer (forward wedge with giant claws)
  'mudmaul': {
    battle: { url: s('/sprites/opponents/mudmaul.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
    footOffsetX: 0,
    footOffsetY: 24,
    worldMap: { url: s('/sprites/opponents_world/mudmaul.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
    icon: { url: s('/sprites/icons/mudmaul.png'), nativeWidth: 64, nativeHeight: 64, facing: 'right', pixelArt: true },
  },

  // 008 Reedstalker — medium — aerial skirmisher (vertical line with long beak)
  'reedstalker': {
    battle: { url: s('/sprites/opponents/reedstalker.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
    worldMap: { url: s('/sprites/opponents_world/reedstalker.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
    icon: { url: s('/sprites/icons/reedstalker.png'), nativeWidth: 64, nativeHeight: 64, facing: 'right', pixelArt: true },
  },
  // },

  // 009 Mirewidow — medium — patient ambusher (wide radial legs + rear bulb)
  'mirewidow': {
    battle: { url: s('/sprites/opponents/mirewidow.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
    footOffsetX: 0,
    footOffsetY: 32,
    worldMap: { url: s('/sprites/opponents_world/mirewidow.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
    icon: { url: s('/sprites/icons/mirewidow.png'), nativeWidth: 64, nativeHeight: 64, facing: 'right', pixelArt: true },
  },

  // 010 Leviamire — large (BOSS) — ancient swamp titan (clustered rising heads)
  'leviamire': {
    battle: { url: s('/sprites/opponents/leviamire.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
    footOffsetX: 8,
    footOffsetY: 20,
    worldMap: { url: s('/sprites/opponents_world/leviamire.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
    icon: { url: s('/sprites/icons/leviamire.png'), nativeWidth: 64, nativeHeight: 64, facing: 'right', pixelArt: true },
  },

  // ── Arena 3 — Ashrock Highlands (levels 12–18) ────────────────────────────

  // 011 Pebblit — small — stony sentinel (circle with large side-block ears)
  'pebblit': {
    battle: { url: s('/sprites/opponents/pebblit.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
    footOffsetX: 24,
    footOffsetY: 18,
    worldMap: { url: s('/sprites/opponents_world/pebblit.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
    icon: { url: s('/sprites/icons/pebblit.png'), nativeWidth: 64, nativeHeight: 64, facing: 'right', pixelArt: true },
  },

  // 012 Screechmite — medium — armoured aggressor (arched oval with front jaws)
  'screechmite': {
    battle: { url: s('/sprites/opponents/screechmite.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
    footOffsetX: 24,
    footOffsetY: 18,
    worldMap: { url: s('/sprites/opponents_world/screechmite.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
    icon: { url: s('/sprites/icons/screechmite.png'), nativeWidth: 64, nativeHeight: 64, facing: 'right', pixelArt: true },
  },

  // 013 Flintor — medium — swift blade (serrated back + long axe-tail)
  'flintor': {
    battle: { url: s('/sprites/opponents/flintor.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
    footOffsetX: 10,
    footOffsetY: 18,
    worldMap: { url: s('/sprites/opponents_world/flintor.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
    icon: { url: s('/sprites/icons/flintor.png'), nativeWidth: 64, nativeHeight: 64, facing: 'right', pixelArt: true },
  },

  // 014 Shockmantis — medium — storm scythe (wide scythe claws + tail arc)
  'shockmantis': {
    battle: { url: s('/sprites/opponents/shockmantis.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
    footOffsetX: 0,
    footOffsetY: 18,
    worldMap: { url: s('/sprites/opponents_world/shockmantis.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
    icon: { url: s('/sprites/icons/shockmantis.png'), nativeWidth: 64, nativeHeight: 64, facing: 'right', pixelArt: true },
  },

  // 015 Thunderox — large (BOSS) — storm colossus (heavy mass with fractured horn spread)
  'thunderox': {
    battle: { url: s('/sprites/opponents/thunderox.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
    footOffsetX: 0,
    footOffsetY: 18,
    worldMap: { url: s('/sprites/opponents_world/thunderox.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
    icon: { url: s('/sprites/icons/thunderox.png'), nativeWidth: 64, nativeHeight: 64, facing: 'right', pixelArt: true },
  },

  // ── Arena 4 — Frostveil Peaks (levels 19–26) ──────────────────────────────

  // 016 Frostscarab — small — glacial bulwark (oval shell with central split)
  // 'frostscarab': {
  //   battle: { url: s('/sprites/opponents/frostscarab.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
  // },

  // 017 Glaciowyrm — medium — relentless tunneler (large head tapering to tail)
  // 'glaciowyrm': {
  //   battle: { url: s('/sprites/opponents/glaciowyrm.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
  // },

  // 018 Glaciermaw — medium — frozen juggernaut (heavy front-loaded rectangle)
  // 'glaciermaw': {
  //   battle: { url: s('/sprites/opponents/glaciermaw.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
  // },

  // 019 Frostwraith — medium — frost phantom (vertical taper with flowing bottom)
  // 'frostwraith': {
  //   battle: { url: s('/sprites/opponents/frostwraith.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
  // },

  // 020 Tuskraal — large (BOSS) — tundra warlord (wide base with tusk cluster)
  // 'tuskraal': {
  //   battle: { url: s('/sprites/opponents/tuskraal.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
  // },

  // ── Arena 5 — Sunforge Summit (levels 27–35) ──────────────────────────────

  // 021 Pyrobeetle — small — magma vanguard (armoured oval with forward horn)
  // 'pyrobeetle': {
  //   battle: { url: s('/sprites/opponents/pyrobeetle.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
  // },

  // 022 Magmacrab — medium — crushing brute (flat wide body with one giant claw)
  // 'magmacrab': {
  //   battle: { url: s('/sprites/opponents/magmacrab.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
  // },

  // 023 Ashraptor — medium — volcanic raider (vertical runner on long legs)
  // 'ashraptor': {
  //   battle: { url: s('/sprites/opponents/ashraptor.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
  // },

  // 024 Cindershell — medium — basalt titan (dome on column legs)
  // 'cindershell': {
  //   battle: { url: s('/sprites/opponents/cindershell.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
  // },

  // 025 Solgryth — large (BOSS) — solar apex predator (radial wing burst)
  // 'solgryth': {
  //   battle: { url: s('/sprites/opponents/solgryth.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
  // },

}

// ── Terrain registry ─────────────────────────────────────────────────────────
// Keyed by arenaId UUID. Background is a CSS gradient string (no image needed).
// Platform PNGs are optional — null renders nothing for that slot.

// ── Platform calibration ──────────────────────────────────────────────────────
// Horizontal alignment: the platform image is centered under the sprite by
// aligning their midpoints (platformWidth/2 under spriteSize/2). No measurement
// needed — just design the platform with the walkable surface centred in the PNG.
//
// Vertical alignment: ovalSurfaceY controls how high up in the platform image
// the walkable surface sits. Tune visually — increase to sink feet lower,
// decrease to raise them.
//
// To add a new platform:
//   1. Export PNG at 512 × any height with alpha, walkable surface centred horizontally.
//   2. Add a PlatformCalibration with the correct nativeH and a starting ovalSurfaceY (~0.38).
//   3. Tune ovalSurfaceY until the sprite's feet land on the surface.
export interface PlatformCalibration {
  /** Native PNG height in pixels. Width is always 512. */
  nativeH: number
  /** Vertical fraction (0–1) from top edge to the walkable surface. Tune visually. */
  ovalSurfaceY: number
}

const ARENA_1_CALIBRATION: PlatformCalibration = {
  nativeH: 240,
  ovalSurfaceY: 128 / 240,
}

export interface TerrainDescriptor {
  /** Ground strip for the player — positioned with `getCoLocatedPlatformStyle` inside the player column on BattlePage. */
  playerPlatformUrl: string | null
  /** Rendered CSS width of the player platform PNG (centred under the sprite stage). */
  playerPlatformRenderedWidth: number | null
  /** When set, overrides default arena_1 calibration for the player platform oval (e.g. arena_2). */
  playerPlatformCalibration?: PlatformCalibration
  /** Oval platform anchored at the opponent sprite's feet */
  opponentPlatformUrl: string | null
  /** Rendered width of the opponent platform image in CSS pixels. */
  opponentPlatformWidth: number | null
  /**
   * Per-platform calibration for the opponent oval.
   * Defaults to arena_1 values if omitted.
   */
  opponentCalibration?: PlatformCalibration
  /**
   * Pre-baked accent hex for arena theming (e.g. '#6aaa30').
   * Consumed by deriveAccentVars() — no runtime image sampling needed.
   */
  accentColor?: string
}

/**
 * Returns inline CSS for a platform image co-located inside a `spriteSize × spriteSize` column
 * (opponent platform shell, or the player column on BattlePage).
 * Horizontally: platform centre (platformWidth/2) aligns with sprite centre (spriteSize/2).
 * Vertically: platform surface (ovalSurfaceY) aligns with sprite feet (bottom of the column).
 */
export function getCoLocatedPlatformStyle(
  platformWidth: number,
  spriteSize: number,
  /** Horizontal foot offset in native pixels (256px canvas). From getOpponentFootOffsets(). */
  nativeFootOffsetX: number = 0,
  cal: PlatformCalibration = ARENA_1_CALIBRATION,
  /** Vertical foot offset in native pixels (256px canvas). Positive = feet higher in canvas → platform moves up. From getOpponentFootOffsets(). */
  nativeFootOffsetY: number = 0,
): { position: 'absolute'; width: number; maxWidth: string; left: number; top: number; zIndex: number; pointerEvents: 'none' } {
  const platformH = Math.round(platformWidth * cal.nativeH / 512)
  const scale = spriteSize / 256
  const displayFootOffsetX = Math.round(nativeFootOffsetX * scale)
  const displayFootOffsetY = Math.round(nativeFootOffsetY * scale)
  return {
    position: 'absolute',
    width: platformWidth,
    maxWidth: 'none',
    left: Math.round((spriteSize - platformWidth) / 2 + displayFootOffsetX),
    top: Math.round(spriteSize - cal.ovalSurfaceY * platformH - displayFootOffsetY),
    zIndex: -1,
    pointerEvents: 'none',
  }
}

const DEFAULT_TERRAIN: TerrainDescriptor = {
  playerPlatformUrl: null,
  playerPlatformRenderedWidth: null,
  opponentPlatformUrl: null,
  opponentPlatformWidth: null,
}

// Arena UUIDs are generated by Supabase at migration time.
// To find a UUID: SELECT id FROM battle_arenas WHERE arena_key = 'arena_N';
const ARENA_TERRAIN: Partial<Record<string, TerrainDescriptor>> = {
  // ── Arena 1 — Verdantroot Forest ──────────────────────────────────────────
  '37543fca-9f22-41c7-83b5-2ded30d7b063': {
    playerPlatformUrl: s('/terrain/arena_1_player_platform.png'),
    playerPlatformRenderedWidth: 320,
    opponentPlatformUrl: s('/terrain/arena_1_opponent_platform.png'),
    opponentPlatformWidth: 256,
    accentColor: '#6aaa30', // moss green
  },
  // ── Arena 2 — Murkmire Wetlands ───────────────────────────────────────────
  'ca277fd4-1dd0-4e6e-a50b-c95bbd878395': {
    playerPlatformUrl: s('/terrain/arena_2_player_platform.png'),
    playerPlatformRenderedWidth: 320,
    opponentPlatformUrl: s('/terrain/arena_2_opponent_platform.png'),
    opponentPlatformWidth: 256,
    accentColor: '#5f7f3a',
  },
  // ── Arena 3 — Ashrock Highlands ───────────────────────────────────────────
  'a353973e-46fe-4757-a90d-a409beddc644': {
    playerPlatformUrl: s('/terrain/arena_3_player_platform.png'),
    playerPlatformRenderedWidth: 320,
    opponentPlatformUrl: s('/terrain/arena_3_opponent_platform.png'),
    opponentPlatformWidth: 256,
    accentColor: '#64748b',
  },
  // ── Arena 4 — Frostveil Peaks ───────────────────────────────────────────────
  'eae801b3-fac1-4d10-9b40-ea652865c57c': {
    playerPlatformUrl: s('/terrain/arena_4_player_platform.png'),
    playerPlatformRenderedWidth: 320,
    opponentPlatformUrl: s('/terrain/arena_4_opponent_platform.png'),
    opponentPlatformWidth: 256,
    accentColor: '#93c5fd',
  },
  // ── Arena 5 — Sunforge Summit ───────────────────────────────────────────────
  'af76c388-9746-4484-8ab5-bfa9f16349f9': {
    playerPlatformUrl: s('/terrain/arena_5_player_platform.png'),
    playerPlatformRenderedWidth: 320,
    opponentPlatformUrl: s('/terrain/arena_5_opponent_platform.png'),
    opponentPlatformWidth: 256,
    accentColor: '#f97316',
  },
}

export function getArenaTerrain(arenaId: string): TerrainDescriptor {
  return ARENA_TERRAIN[arenaId] ?? DEFAULT_TERRAIN
}

// ── Turn-order timeline icon registry ───────────────────────────────────────
// Small portrait icons used in the battle HUD turn-order chips (renders at 28px).
// Distinct from full battle/world-map sprites — these are face/bust crops or
// dedicated icon art designed to read clearly at very small sizes.
//
// To activate an icon:
//   1. Drop a square PNG into public/sprites/icons/
//   2. Uncomment the entry below and confirm nativeSize matches the PNG.
//   3. Icon sprites are 64×64 pixel art.
//
// Player icons are keyed by stage. Opponent icons live beside battle/worldMap in OPPONENT_SPRITES.

const PLAYER_ICONS: Partial<Record<string, SpriteDescriptor>> = {
  'baby': { url: s('/sprites/icons/player_baby.png'), nativeWidth: 64, nativeHeight: 64, facing: 'right', pixelArt: true },
  // 'adult':    { url: s('/sprites/icons/player_adult.png'),    nativeWidth: 64, nativeHeight: 64, facing: 'right', pixelArt: true },
  // 'champion': { url: s('/sprites/icons/player_champion.png'), nativeWidth: 64, nativeHeight: 64, facing: 'right', pixelArt: true },
}

// ── Animation registry ───────────────────────────────────────────────────────
// Key format: `${stage}_${condition}_${animationType}`
const ANIMATIONS: Partial<Record<string, AnimationDescriptor>> = {
  // 'baby_steady_idle': { frames: [s('/sprites/player/baby_steady_f1.png'), s('/sprites/player/baby_steady_f2.png')], fps: 4 },
}

// ── Public API ───────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '_')
}

export function getPlayerSpriteDescriptor(
  stage: string,
  condition: string,
): SpriteDescriptor | null {
  // Exact match first, then fall back to steady for that stage
  return PLAYER_SPRITES[`${stage}_${condition}`] ?? PLAYER_SPRITES[`${stage}_steady`] ?? null
}

export function getPlayerBattleSpriteDescriptor(
  stage: string,
  condition: string,
): SpriteDescriptor | null {
  // Exact match first, then fall back to steady for that stage
  return PLAYER_BATTLE_SPRITES[`${stage}_${condition}`] ?? PLAYER_BATTLE_SPRITES[`${stage}_steady`] ?? null
}

export function getPlayerWorldMapSpriteDescriptor(
  stage: string,
  condition: string,
): SpriteDescriptor | null {
  return (
    PLAYER_WORLD_MAP_SPRITES[`${stage}_${condition}`] ??
    PLAYER_WORLD_MAP_SPRITES[`${stage}_steady`] ??
    getPlayerBattleSpriteDescriptor(stage, condition)
  )
}

export function getPlayerTimelineIcon(stage: string): SpriteDescriptor | null {
  return PLAYER_ICONS[stage] ?? null
}

export function getOpponentTimelineIcon(name: string): SpriteDescriptor | null {
  return OPPONENT_SPRITES[slugify(name)]?.icon ?? null
}

export function getOpponentSpriteDescriptor(name: string): SpriteDescriptor | null {
  return OPPONENT_SPRITES[slugify(name)]?.battle ?? null
}

export function getOpponentWorldMapSpriteDescriptor(name: string): SpriteDescriptor | null {
  const entry = OPPONENT_SPRITES[slugify(name)]
  return entry?.worldMap ?? entry?.battle ?? null
}

// export function getOpponentRecoverySpriteDescriptor(name: string): SpriteDescriptor | null {
//   return OPPONENT_SPRITES[slugify(name)]?.recovering ?? null
// }

/**
 * Returns the foot offset for an opponent in NATIVE pixels (256px canvas).
 * Positive = feet are to the right of canvas centre.
 * Returns 0 if no offset is registered.
 */
export function getOpponentFootOffsets(name: string): { x: number; y: number } {
  const entry = OPPONENT_SPRITES[slugify(name)]
  return { x: entry?.footOffsetX ?? 0, y: entry?.footOffsetY ?? 0 }
}

export function getAnimationDescriptor(
  stage: string,
  condition: string,
  animation: 'idle' | 'attack' | 'hurt' | 'faint',
): AnimationDescriptor | null {
  return ANIMATIONS[`${stage}_${condition}_${animation}`] ?? null
}
