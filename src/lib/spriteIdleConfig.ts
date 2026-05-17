import { IDLE_ANIM } from './battleAnimationConfig'

type SizeClass = 'small' | 'medium' | 'large'

/**
 * Per-sprite idle animation overrides stored in the sprite registry.
 * Any field omitted falls back to the IDLE_ANIM size-class defaults.
 * Set disableSway / disableBreathe for creatures that shouldn't move (e.g. rigid mechanical types).
 */
export interface SpriteIdleOverride {
  breatheDurationS?: number
  breatheScale?: number
  swayDurationS?: number
  swayAngleDeg?: number
  disableSway?: boolean
  disableBreathe?: boolean
}

/**
 * Fully resolved values ready for CreatureSprite to apply as CSS custom properties.
 * null means the animation is disabled for this sprite.
 */
export interface ResolvedIdleConfig {
  breathe: {
    durationS: number
    scale: number
    distress: boolean
    compressScale: number
  } | null
  sway: {
    durationS: number
    angleDeg: number
    delayS: number
  } | null
}

const LOW_HP_THRESHOLD = 0.30

/**
 * Merges size-class defaults → per-sprite override → HP distress modifier
 * into a single ResolvedIdleConfig for CreatureSprite to consume.
 *
 * @param sizeClass      Opponent size class ('small' | 'medium' | 'large')
 * @param override       Optional per-sprite tuning from the sprite registry
 * @param hpRatio        Current HP / max HP (0–1). ≤ 0.30 triggers distress
 * @param swayDelayS     Phase offset in seconds so two sprites don't sway in sync
 */
export function resolveIdleConfig(
  sizeClass: SizeClass,
  override: Partial<SpriteIdleOverride> | undefined,
  hpRatio: number,
  swayDelayS = 0,
): ResolvedIdleConfig {
  const distress = hpRatio <= LOW_HP_THRESHOLD

  const breathe: ResolvedIdleConfig['breathe'] = override?.disableBreathe
    ? null
    : {
        durationS: distress
          ? (override?.breatheDurationS != null
              ? override.breatheDurationS * 0.55  // distress = 55% of custom duration
              : IDLE_ANIM.distressBreatheDurationS[sizeClass])
          : (override?.breatheDurationS ?? IDLE_ANIM.breatheDurationS[sizeClass]),
        scale: distress
          ? (override?.breatheScale != null
              ? 1 + (override.breatheScale - 1) * 1.5  // distress = 1.5× the custom swell
              : IDLE_ANIM.distressBreatheScale[sizeClass])
          : (override?.breatheScale ?? IDLE_ANIM.breatheScale[sizeClass]),
        distress,
        compressScale: IDLE_ANIM.distressBreatheCompressScale[sizeClass],
      }

  const sway: ResolvedIdleConfig['sway'] = override?.disableSway
    ? null
    : {
        durationS: override?.swayDurationS ?? IDLE_ANIM.swayDurationS[sizeClass],
        angleDeg: override?.swayAngleDeg ?? IDLE_ANIM.swayAngleDeg[sizeClass],
        delayS: swayDelayS,
      }

  return { breathe, sway }
}
