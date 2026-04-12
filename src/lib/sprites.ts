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
  'baby_recovering': { url: s('/sprites/player_battle/baby_recovering.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
  // 'adult_steady':        { url: s('/sprites/player_battle/adult_steady.png'),        nativeWidth: 64, nativeHeight: 64, facing: 'right', pixelArt: false },
  // 'adult_thriving':      { url: s('/sprites/player_battle/adult_thriving.png'),      nativeWidth: 64, nativeHeight: 64, facing: 'right', pixelArt: false },
  // 'adult_recovering':    { url: s('/sprites/player_battle/adult_recovering.png'),    nativeWidth: 64, nativeHeight: 64, facing: 'right', pixelArt: false },
  // 'champion_steady':     { url: s('/sprites/player_battle/champion_steady.png'),     nativeWidth: 64, nativeHeight: 64, facing: 'right', pixelArt: false },
  // 'champion_thriving':   { url: s('/sprites/player_battle/champion_thriving.png'),   nativeWidth: 64, nativeHeight: 64, facing: 'right', pixelArt: false },
  // 'champion_recovering': { url: s('/sprites/player_battle/champion_recovering.png'), nativeWidth: 64, nativeHeight: 64, facing: 'right', pixelArt: false },
}

// ── Hit impact registry ──────────────────────────────────────────────────────
// Drop a PNG into public/sprites/effects/ and set the URL below.
// null = no impact PNG registered yet (showHitImpact() becomes a no-op).
const HIT_IMPACT_URL: string | null = s('/sprites/effects/hit_impact.png')

/** Returns the hit impact PNG URL, or null if none is registered. */
export function getHitImpactUrl(): string | null {
  return HIT_IMPACT_URL
}

// ── Opponent sprite registry ─────────────────────────────────────────────────
// Key format: slugified opponent name e.g. "Pebble Pup" → "pebble_pup"
// `recovering` is optional — omit it and the sprite stays fainted after defeat.
// `footOffsetX` — horizontal offset in NATIVE pixels (256px canvas) from the
//   canvas centre to where the creature's feet actually stand. Positive = feet
//   are to the right of canvas centre. The renderer converts to display pixels
//   automatically. Set this when a creature's stance is off-centre in the PNG.
interface OpponentSpriteEntry {
  battle: SpriteDescriptor
  // recovering?: SpriteDescriptor
  footOffsetX?: number
}

const OPPONENT_SPRITES: Partial<Record<string, OpponentSpriteEntry>> = {
  'pebble_pup': {
    battle:     { url: s('/sprites/opponents/pebble_pup.png'),           nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
    // recovering: { url: s('/sprites/opponents/pebble_pup_recovering.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
  },
  'cinder_finch': {
    battle: { url: s('/sprites/opponents/cinder_finch.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
    // recovering: { url: s('/sprites/opponents/cinder_finch_recovering.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
  },
  'mossback_ram': {
    battle: { url: s('/sprites/opponents/mossback_ram.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
    // recovering: { url: s('/sprites/opponents/mossback_ram_recovering.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
  },
  'tide_lynx': {
    battle: { url: s('/sprites/opponents/tide_lynx.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
    // recovering: { url: s('/sprites/opponents/tide_lynx_recovering.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
  },
  'sunscale_drake': {
    battle: { url: s('/sprites/opponents/sunscale_drake.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
    // recovering: { url: s('/sprites/opponents/sunscale_drake_recovering.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
  },
  'ember_goat': {
    battle: { url: s('/sprites/opponents/ember_goat.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
    // recovering: { url: s('/sprites/opponents/ember_goat_recovering.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
  },
  //'magma_crab': {
  //  battle: { url: s('/sprites/opponents/magma_crab.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
  //  recovering: { url: s('/sprites/opponents/magma_crab_recovering.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
  //},
  //'cindertail_fox': {
  //  battle: { url: s('/sprites/opponents/cindertail_fox.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
  //  recovering: { url: s('/sprites/opponents/cindertail_fox_recovering.png'), nativeWidth: 256, nativeHeight: 256, facing: 'right', pixelArt: true },
  //},
}

// ── Terrain registry ─────────────────────────────────────────────────────────
// Keyed by arenaId UUID. Background is a CSS gradient string (no image needed).
// Platform PNGs are optional — null renders nothing for that slot.
export interface PlatformStyle {
  width: number
  left?: number | string
  right?: number | string
  top?: number | string
  bottom?: number | string
}

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
  ovalSurfaceY: 97 / 240,
}

export interface TerrainDescriptor {
  /** Ground strip anchored bottom-left under the player sprite */
  playerPlatformUrl: string | null
  playerPlatformStyle: PlatformStyle | null
  /** Oval platform anchored at the opponent sprite's feet */
  opponentPlatformUrl: string | null
  /** Rendered width of the opponent platform image in CSS pixels. */
  opponentPlatformWidth: number | null
  /**
   * Per-platform calibration for the opponent oval.
   * Defaults to arena_1 values if omitted.
   */
  opponentCalibration?: PlatformCalibration
}

// Sprite layout constants for the player platform (bottom-left anchor).
// These must stay in sync with the player sprite className values in BattlePage.
const PLAYER_LEFT          = 24    // left-6  (1.5 rem)
const PLAYER_SIZE          = 144   // baby player display size
const PLAYER_FEET_FROM_BOT = 16    // bottom-4 (1 rem)

/**
 * Computes the absolute CSS position for the player platform image.
 * Horizontally: platform centre (renderedWidth/2) sits under the player sprite centre.
 * Vertically:   platform surface (ovalSurfaceY) aligns with the sprite's feet.
 */
export function computePlayerPlatformStyle(
  renderedWidth: number,
  cal: PlatformCalibration = ARENA_1_CALIBRATION,
): PlatformStyle {
  const renderedH = Math.round(renderedWidth * cal.nativeH / 512)
  const spriteCenterX = PLAYER_LEFT + PLAYER_SIZE / 2
  return {
    width:  renderedWidth,
    left: Math.round(spriteCenterX - renderedWidth / 2),
    bottom: Math.round(PLAYER_FEET_FROM_BOT - renderedH * (1 - cal.ovalSurfaceY)),
  }
}

/**
 * Returns inline CSS for the opponent platform image co-located inside the
 * sprite's wrapper div.
 * Horizontally: platform centre (platformWidth/2) aligns with sprite centre (spriteSize/2).
 * Vertically:   platform surface (ovalSurfaceY) aligns with sprite feet (spriteSize).
 */
export function getCoLocatedPlatformStyle(
  platformWidth: number,
  spriteSize: number,
  /** Foot offset in native pixels (256px canvas). From getOpponentFootOffsetX(). */
  nativeFootOffsetX: number = 0,
  cal: PlatformCalibration = ARENA_1_CALIBRATION,
): { position: 'absolute'; width: number; maxWidth: string; left: number; top: number; zIndex: number; pointerEvents: 'none' } {
  const platformH = Math.round(platformWidth * cal.nativeH / 512)
  const displayFootOffsetX = Math.round(nativeFootOffsetX * (spriteSize / 256))
  return {
    position: 'absolute',
    width: platformWidth,
    maxWidth: 'none',
    left: Math.round((spriteSize - platformWidth) / 2 + displayFootOffsetX),
    top: Math.round(spriteSize - cal.ovalSurfaceY * platformH),
    zIndex: -1,
    pointerEvents: 'none',
  }
}

const DEFAULT_TERRAIN: TerrainDescriptor = {
  playerPlatformUrl: null,
  playerPlatformStyle: null,
  opponentPlatformUrl: null,
  opponentPlatformWidth: null,
}

const ARENA_2_CALIBRATION: PlatformCalibration = {
  nativeH: 350,
  ovalSurfaceY: 0.38, // TODO: tune visually until sprite feet land on oval
}

const ARENA_TERRAIN: Partial<Record<string, TerrainDescriptor>> = {
  '37543fca-9f22-41c7-83b5-2ded30d7b063': {
    playerPlatformUrl:     s('/terrain/arena_1_player_platform.png'),
    playerPlatformStyle:   computePlayerPlatformStyle(320),
    opponentPlatformUrl:   s('/terrain/arena_1_opponent_platform.png'),
    opponentPlatformWidth: 224,
    // opponentCalibration omitted → falls back to ARENA_1_CALIBRATION
  },
  'ca277fd4-1dd0-4e6e-a50b-c95bbd878395': {
    playerPlatformUrl: s('/terrain/arena_2_player_platform.png'),
    playerPlatformStyle: computePlayerPlatformStyle(320, ARENA_2_CALIBRATION),
    opponentPlatformUrl: s('/terrain/arena_2_opponent_platform.png'),
    opponentPlatformWidth: 224,
    opponentCalibration: ARENA_2_CALIBRATION,
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
  return OPPONENT_SPRITES[slugify(name)]?.battle ?? null
}

// export function getOpponentRecoverySpriteDescriptor(name: string): SpriteDescriptor | null {
//   return OPPONENT_SPRITES[slugify(name)]?.recovering ?? null
// }

/**
 * Returns the foot offset for an opponent in NATIVE pixels (256px canvas).
 * Positive = feet are to the right of canvas centre.
 * Returns 0 if no offset is registered.
 */
export function getOpponentFootOffsetX(name: string): number {
  return OPPONENT_SPRITES[slugify(name)]?.footOffsetX ?? 0
}

export function getAnimationDescriptor(
  stage: string,
  condition: string,
  animation: 'idle' | 'attack' | 'hurt' | 'faint',
): AnimationDescriptor | null {
  return ANIMATIONS[`${stage}_${condition}_${animation}`] ?? null
}
