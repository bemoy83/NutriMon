/**
 * Shared timing constants for all battle animation sequences.
 *
 * These values are the single source of truth. Any CSS animation string,
 * timer, or triggerAnimation() call that controls battle visuals must use
 * these constants so timing stays in sync as the system grows.
 *
 * Tuning guide:
 *  ENTRY_DELAY_*_MS — per-type hold times before the next entry appears (drives pacing feel)
 *  HURT_MS          — white flash duration on a normal hit
 *  HURT_CRIT_MS    — gold flash duration on a critical hit (slightly longer for drama)
 *  FAINT_BLINK_MS  — blink phase before the dissolve on faint
 *  FAINT_MS        — total faint animation (blink + SVG dissolve; blink starts at 0, dissolve at 400 ms)
 *  DAMAGE_NUMBER_MS — float-up duration for damage numbers
 *  CRIT_BADGE_MS   — "CRIT!" badge pop + fade duration
 *  HIT_IMPACT_MS   — hit impact PNG scale + fade duration
 *  FOCUSED_HIT_SPACING_MS — delay between focused attack hit beats
 *  DEFEND_GUARD_MS — blue guard ring duration for defend actions
 *  FOCUS_CHARGE_MS — gold charge aura duration for focus actions
 */
export const BATTLE_ANIM = {
  /**
   * Time (ms) each entry type is held on screen before the next entry appears.
   * Used as cumulative offsets so fast entries don't slow down impactful ones.
   */
  ENTRY_DELAY_INITIATIVE_MS: 1200,   // quick context-setter — just names who goes first
  ENTRY_DELAY_ACTION_HIT_MS: 2600,  // attack / skill / special with damage — read + process effect
  ENTRY_DELAY_ACTION_MS: 2000,      // defend / focus — no damage number competing for attention
  ENTRY_DELAY_RESULT_MS: 1800,      // victory / defeat hold before outcome modal

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
  /** Time between focused attack hit starts (ms). Used by both impact sprites and target hit flashes. */
  FOCUSED_HIT_SPACING_MS: 180,
  /** Defensive guard ring duration (ms). Must match `battle-guard-ring` and `battle-guard-spark` @keyframes. */
  DEFEND_GUARD_MS: 560,
  /** Focus charge aura duration (ms). Must match `battle-focus-aura` and `battle-focus-spark` @keyframes. */
  FOCUS_CHARGE_MS: 650,

  /**
   * Full-screen flash duration for special actions (ms). Must match `special-flash` @keyframes.
   * Covers: 0ms burst peak → hold → fade to transparent.
   */
  SPECIAL_FLASH_MS: 450,

  /** Regen heal aura + sparks + floating +HP number duration (ms). Reuses focus-aura/spark keyframes. */
  HEAL_EFFECT_MS: 900,
} as const
