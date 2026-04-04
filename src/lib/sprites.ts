// Sprite registry — single source of truth for all creature/opponent sprite URLs.
// Returns null for unregistered keys so components can render a fallback.
// To add a sprite: drop the PNG into public/sprites/, add an entry below.

// Vite's BASE_URL handles the /NutriMon/ prefix in production and dev.
// Strips trailing slash so we can write `${base}/sprites/...` cleanly.
const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')

function s(path: string): string {
  return `${base}${path}`
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
  // 'adult_steady':       { url: s('/sprites/player/adult_steady.png'),       nativeWidth: 64, nativeHeight: 64, facing: 'right' },
  // 'adult_thriving':     { url: s('/sprites/player/adult_thriving.png'),     nativeWidth: 64, nativeHeight: 64, facing: 'right' },
  // 'adult_recovering':   { url: s('/sprites/player/adult_recovering.png'),   nativeWidth: 64, nativeHeight: 64, facing: 'right' },
  // 'champion_steady':    { url: s('/sprites/player/champion_steady.png'),    nativeWidth: 64, nativeHeight: 64, facing: 'right' },
  // 'champion_thriving':  { url: s('/sprites/player/champion_thriving.png'),  nativeWidth: 64, nativeHeight: 64, facing: 'right' },
  // 'champion_recovering':{ url: s('/sprites/player/champion_recovering.png'),nativeWidth: 64, nativeHeight: 64, facing: 'right' },
}

// ── Player battle sprite registry ───────────────────────────────────────────
// Side-profile sprites used in the battle arena (distinct from front-facing page sprites).
// Key format: `${stage}_${condition}`
const PLAYER_BATTLE_SPRITES: Partial<Record<string, SpriteDescriptor>> = {
  'baby_steady': { url: s('/sprites/player_battle/baby_steady.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
  // 'baby_thriving':       { url: s('/sprites/player_battle/baby_thriving.png'),       nativeWidth: 64, nativeHeight: 64, facing: 'right', pixelArt: false },
  // 'baby_recovering':     { url: s('/sprites/player_battle/baby_recovering.png'),     nativeWidth: 64, nativeHeight: 64, facing: 'right', pixelArt: false },
  // 'adult_steady':        { url: s('/sprites/player_battle/adult_steady.png'),        nativeWidth: 64, nativeHeight: 64, facing: 'right', pixelArt: false },
  // 'adult_thriving':      { url: s('/sprites/player_battle/adult_thriving.png'),      nativeWidth: 64, nativeHeight: 64, facing: 'right', pixelArt: false },
  // 'adult_recovering':    { url: s('/sprites/player_battle/adult_recovering.png'),    nativeWidth: 64, nativeHeight: 64, facing: 'right', pixelArt: false },
  // 'champion_steady':     { url: s('/sprites/player_battle/champion_steady.png'),     nativeWidth: 64, nativeHeight: 64, facing: 'right', pixelArt: false },
  // 'champion_thriving':   { url: s('/sprites/player_battle/champion_thriving.png'),   nativeWidth: 64, nativeHeight: 64, facing: 'right', pixelArt: false },
  // 'champion_recovering': { url: s('/sprites/player_battle/champion_recovering.png'), nativeWidth: 64, nativeHeight: 64, facing: 'right', pixelArt: false },
}

// ── Opponent sprite registry ─────────────────────────────────────────────────
// Key format: slugified opponent name e.g. "Pebble Pup" → "pebble_pup"
const OPPONENT_SPRITES: Partial<Record<string, SpriteDescriptor>> = {
  'pebble_pup': { url: s('/sprites/opponents/pebble_pup.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
  // 'cinder_finch':   { url: s('/sprites/opponents/cinder_finch.png'),   nativeWidth: 64, nativeHeight: 64, facing: 'left' },
  // 'mossback_ram':   { url: s('/sprites/opponents/mossback_ram.png'),   nativeWidth: 64, nativeHeight: 64, facing: 'left' },
  // 'tide_lynx':      { url: s('/sprites/opponents/tide_lynx.png'),      nativeWidth: 64, nativeHeight: 64, facing: 'left' },
  // 'sunscale_drake': { url: s('/sprites/opponents/sunscale_drake.png'), nativeWidth: 64, nativeHeight: 64, facing: 'left' },
}

// ── Terrain registry ─────────────────────────────────────────────────────────
// Keyed by arenaId UUID. Background is a CSS gradient string (no image needed).
// Platform PNGs are optional — null renders nothing for that slot.
export interface PlatformStyle {
  width: number
  left?: number
  right?: number
  top?: number
  bottom?: number
}

export interface TerrainDescriptor {
  /** CSS gradient applied to the arena div background */
  backgroundCss: string
  /** Ground strip anchored bottom-left under the player sprite */
  playerPlatformUrl: string | null
  playerPlatformStyle: PlatformStyle | null
  /** Oval platform anchored at the opponent sprite's feet */
  opponentPlatformUrl: string | null
  opponentPlatformStyle: PlatformStyle | null
}

// ── Platform image spec ───────────────────────────────────────────────────────
// All platform PNGs MUST conform to this spec for automatic positioning.
//
//   Canvas:               512 × 240 px with alpha channel
//   Oval centre X:        297 px from left  (≈58% — calibrated from arena_1)
//   Oval walkable surface:  97 px from top  (≈40% — calibrated from arena_1)
//
// To add a new arena platform:
//   1. Export PNG at exactly 512 × 240 px with alpha
//   2. Place the oval centre at x=297, walkable surface top at y=97
//   3. Use computePlayerPlatformStyle(width) / computeOpponentPlatformStyle(width)
//      in ARENA_TERRAIN — no manual pixel tuning needed
const PLATFORM_SPEC = {
  nativeW: 512,
  nativeH: 240,
  ovalCenterX:  297 / 512, // fraction from left edge
  ovalSurfaceY:  97 / 240, // fraction from top edge (walkable surface, not oval centre)
} as const

// Sprite layout constants — must stay in sync with BattlePage className values
const PLAYER_LEFT         = 24  // left-6  (1.5 rem)
const PLAYER_SIZE         = 128
const PLAYER_FEET_FROM_BOT = 16  // bottom-4 (1 rem)

const OPP_RIGHT           = 24  // right-6
const OPP_SIZE            = 128
const OPP_FEET_FROM_TOP   = 16 + OPP_SIZE  // top-4 + sprite height = 144

/**
 * Computes the absolute CSS position for the player platform image so the oval
 * centre sits directly beneath the player sprite, regardless of rendered width.
 * Only valid for spec-conforming images (512×240, oval at x=297 y=97).
 */
export function computePlayerPlatformStyle(renderedWidth: number): PlatformStyle {
  const renderedH = Math.round(renderedWidth * PLATFORM_SPEC.nativeH / PLATFORM_SPEC.nativeW)
  const spriteCenterX = PLAYER_LEFT + PLAYER_SIZE / 2
  return {
    width:  renderedWidth,
    left:   Math.round(spriteCenterX - PLATFORM_SPEC.ovalCenterX * renderedWidth),
    bottom: Math.round(PLAYER_FEET_FROM_BOT - renderedH * (1 - PLATFORM_SPEC.ovalSurfaceY)),
  }
}

/**
 * Computes the absolute CSS position for the opponent platform image so the oval
 * centre sits directly beneath the opponent sprite, regardless of rendered width.
 * Only valid for spec-conforming images (512×240, oval at x=297 y=97).
 */
export function computeOpponentPlatformStyle(renderedWidth: number): PlatformStyle {
  const renderedH = Math.round(renderedWidth * PLATFORM_SPEC.nativeH / PLATFORM_SPEC.nativeW)
  const spriteCenterFromRight = OPP_RIGHT + OPP_SIZE / 2
  return {
    width: renderedWidth,
    right: Math.round(spriteCenterFromRight - (1 - PLATFORM_SPEC.ovalCenterX) * renderedWidth),
    top:   Math.round(OPP_FEET_FROM_TOP - PLATFORM_SPEC.ovalSurfaceY * renderedH),
  }
}

const DEFAULT_TERRAIN: TerrainDescriptor = {
  backgroundCss: 'linear-gradient(to bottom, #c8dba0 0%, #6aaa30 50%, #3d8018 100%)',
  playerPlatformUrl: null,
  playerPlatformStyle: null,
  opponentPlatformUrl: null,
  opponentPlatformStyle: null,
}

const ARENA_TERRAIN: Partial<Record<string, TerrainDescriptor>> = {
  '37543fca-9f22-41c7-83b5-2ded30d7b063': {
    backgroundCss: 'linear-gradient(to bottom, #c8dba0 0%, #6aaa30 50%, #3d8018 100%)',
    playerPlatformUrl:     s('/terrain/arena_1_player_platform.png'),
    playerPlatformStyle:   computePlayerPlatformStyle(320),
    opponentPlatformUrl:   s('/terrain/arena_1_opponent_platform.png'),
    opponentPlatformStyle: computeOpponentPlatformStyle(224),
  },
}

export function getArenaTerrain(arenaId: string): TerrainDescriptor {
  return ARENA_TERRAIN[arenaId] ?? DEFAULT_TERRAIN
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

export function getOpponentSpriteDescriptor(name: string): SpriteDescriptor | null {
  return OPPONENT_SPRITES[slugify(name)] ?? null
}

export function getAnimationDescriptor(
  stage: string,
  condition: string,
  animation: 'idle' | 'attack' | 'hurt' | 'faint',
): AnimationDescriptor | null {
  return ANIMATIONS[`${stage}_${condition}_${animation}`] ?? null
}
