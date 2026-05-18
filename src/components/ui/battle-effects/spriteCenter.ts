/**
 * Returns the visual center of a sprite stage for effect positioning.
 * cx is the horizontal midpoint; cy sits at 44% of the stage height to
 * target the torso rather than the bounding-box center (sprites are
 * typically grounded at the bottom, so the body mass sits above center).
 */
export function spriteCenter(displaySize: number): { cx: number; cy: number } {
  return { cx: displaySize / 2, cy: displaySize * 0.44 }
}
