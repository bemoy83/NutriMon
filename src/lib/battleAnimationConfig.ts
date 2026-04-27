/**
 * Shared timing constants for all battle animation sequences.
 *
 * These values are the single source of truth. Any CSS animation string,
 * timer, or triggerAnimation() call that controls battle visuals must use
 * these constants so timing stays in sync as the system grows.
 *
 * Tuning guide:
 *  ENTRY_DELAY_MS  — gap between battle log entries being revealed (drives pacing feel)
 *  HURT_MS         — white flash duration on a normal hit
 *  HURT_CRIT_MS    — gold flash duration on a critical hit (slightly longer for drama)
 *  FAINT_BLINK_MS  — blink phase before the dissolve on faint
 *  FAINT_MS        — total faint animation (blink + SVG dissolve; blink starts at 0, dissolve at 400 ms)
 *  DAMAGE_NUMBER_MS — float-up duration for damage numbers
 *  CRIT_BADGE_MS   — "CRIT!" badge pop + fade duration
 *  HIT_IMPACT_MS   — hit impact PNG scale + fade duration
 *  DEFEND_GUARD_MS — blue guard ring duration for defend actions
 *  FOCUS_CHARGE_MS — gold charge aura duration for focus actions
 */
export const BATTLE_ANIM = {
  /** Delay between each sequential log entry being shown (ms). */
  ENTRY_DELAY_MS: 1200,

  /** Normal hit flash duration (ms). Must match `hit-flash` @keyframes. */
  HURT_MS: 500,
  /** Critical hit flash duration (ms). Must match `hit-flash-crit` @keyframes. */
  HURT_CRIT_MS: 550,

  /** Blink phase before dissolve on faint (ms). Must match `faint-blink` @keyframes. */
  FAINT_BLINK_MS: 400,
  /**
   * Total faint sequence duration (ms).
   * Covers blink (0–400 ms) + SVG noise dissolve (400–1400 ms).
   * The SMIL `begin="0.4s"` in CreatureSprite aligns with FAINT_BLINK_MS.
   */
  FAINT_MS: 1400,

  /** Floating damage number animation duration (ms). Must match `float-up` @keyframes. */
  DAMAGE_NUMBER_MS: 1000,
  /** CRIT badge pop animation duration (ms). Must match `crit-pop` @keyframes. */
  CRIT_BADGE_MS: 900,
  /** Hit impact PNG scale/rotate animation duration (ms). Must match `hit-impact` @keyframes. */
  HIT_IMPACT_MS: 350,
  /** Defensive guard ring duration (ms). Must match `battle-guard-ring` and `battle-guard-spark` @keyframes. */
  DEFEND_GUARD_MS: 560,
  /** Focus charge aura duration (ms). Must match `battle-focus-aura` and `battle-focus-spark` @keyframes. */
  FOCUS_CHARGE_MS: 650,

  /**
   * Full-screen flash duration for special actions (ms). Must match `special-flash` @keyframes.
   * Covers: 0ms burst peak → hold → fade to transparent.
   */
  SPECIAL_FLASH_MS: 450,
} as const
