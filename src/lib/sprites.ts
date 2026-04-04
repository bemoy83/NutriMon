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
