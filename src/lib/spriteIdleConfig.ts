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
  breatheScaleX?: number
  swayDurationS?: number
  swayAngleDeg?: number
  swayShiftPx?: number
  /** 'rotate' = rotateZ pendulum (default for large). 'shift' = translateX rock (default for small/medium). */
  swayStyle?: 'rotate' | 'shift'
  disableSway?: boolean
  disableBreathe?: boolean
}

/**
 * Fully resolved values ready for CreatureSprite and SpriteStage to apply as CSS custom properties.
 * null means the animation is disabled for this sprite.
 */
export interface ResolvedIdleConfig {
  breathe: {
    durationS: number
    scale: number
    scaleX: number
    distress: boolean
    compressScale: number
    compressScaleX: number
  } | null
  sway: {
    durationS: number
    angleDeg: number
    shiftPx: number
    style: 'rotate' | 'shift'
    delayS: number
  } | null
}

const LOW_HP_THRESHOLD = 0.30

/**
 * Merges size-class defaults → per-sprite override → HP distress modifier
 * into a single ResolvedIdleConfig for CreatureSprite and SpriteStage to consume.
 *
 * @param sizeClass   Opponent size class ('small' | 'medium' | 'large')
 * @param override    Optional per-sprite tuning from the sprite registry
 * @param hpRatio     Current HP / max HP (0–1). ≤ 0.30 triggers distress
 * @param swayDelayS  Phase offset in seconds so two sprites don't sway in sync
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
              ? override.breatheDurationS * 0.55
              : IDLE_ANIM.distressBreatheDurationS[sizeClass])
          : (override?.breatheDurationS ?? IDLE_ANIM.breatheDurationS[sizeClass]),
        scale: distress
          ? (override?.breatheScale != null
              ? 1 + (override.breatheScale - 1) * 1.5
              : IDLE_ANIM.distressBreatheScale[sizeClass])
          : (override?.breatheScale ?? IDLE_ANIM.breatheScale[sizeClass]),
        scaleX: distress
          ? (override?.breatheScaleX != null
              ? 1 + (override.breatheScaleX - 1) * 1.5
              : IDLE_ANIM.distressBreatheScaleX[sizeClass])
          : (override?.breatheScaleX ?? IDLE_ANIM.breatheScaleX[sizeClass]),
        distress,
        compressScale: IDLE_ANIM.distressBreatheCompressScale[sizeClass],
        compressScaleX: IDLE_ANIM.distressBreatheCompressScaleX[sizeClass],
      }

  const sway: ResolvedIdleConfig['sway'] = override?.disableSway
    ? null
    : {
        durationS: override?.swayDurationS ?? IDLE_ANIM.swayDurationS[sizeClass],
        angleDeg: override?.swayAngleDeg ?? IDLE_ANIM.swayAngleDeg[sizeClass],
        shiftPx: override?.swayShiftPx ?? IDLE_ANIM.swayShiftPx[sizeClass],
        style: override?.swayStyle ?? 'rotate',
        delayS: swayDelayS,
      }

  return { breathe, sway }
}
