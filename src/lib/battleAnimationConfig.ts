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
 *  *_ANTICIPATION_MS — short pre-action reads before effects resolve
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

  /** Short wind-up before normal attack and fast damage skills resolve. */
  ATTACK_ANTICIPATION_MS: 140,
  /** Longer wind-up for heavy damage skills. */
  HEAVY_SKILL_ANTICIPATION_MS: 240,
  /** Short readability beat before support effects appear. */
  SUPPORT_ANTICIPATION_MS: 120,
  /** Reserved micro-pause budget for heavier contacts. */
  HIT_STOP_MS: 45,

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
  /** Faster hit cadence for overdrive's five-hit sequence. */
  OVERDRIVE_HIT_SPACING_MS: 115,
  /** Shield dome duration (ms). Must match `shield-dome-in` @keyframes. */
  DEFEND_GUARD_MS: 900,
  /** Longer guard read for Counter Stance. */
  COUNTER_STANCE_GUARD_MS: 980,
  /** Focus charge effect total duration (ms). Covers mote orbit (640ms) + shrink rings + burst out (620+220ms). */
  FOCUS_CHARGE_MS: 860,
  /** FP spend pips converge before a skill resolves. */
  FOCUS_SPEND_MS: 520,

  /**
   * Full-screen flash duration for special actions (ms). Must match `special-flash` @keyframes.
   * Covers: 0ms burst peak → hold → fade to transparent.
   */
  SPECIAL_FLASH_MS: 450,

  /** Regen heal effect total duration (ms). Covers mote rise + staggered ring sequence (0/180/380ms delays + 900ms longest ring). */
  HEAL_EFFECT_MS: 1300,
  /** Delay before regen's +HP number appears. Must match the `regen-number-pop` animation delay. */
  REGEN_NUMBER_DELAY_MS: 160,

  /** Attacker lunge slide duration (ms). Must match `battle-lunge-*` @keyframes. */
  LUNGE_MS: 320,
  /** Time from lunge start to peak forward position (ms) — target hurt fires here. */
  LUNGE_PEAK_MS: 90,

  /** Ground shockwave ellipse expand + fade duration (ms). Must match `ground-shockwave` @keyframes. */
  GROUND_SHOCKWAVE_MS: 420,

  /** Charge build-up glow on the attacker's sprite stage before the lunge (ms). Must match `charge-glow` @keyframes. */
  CHARGE_GLOW_MS: 300,
  /** Green edge glow on the healed sprite during regen (ms). Must match `heal-glow` @keyframes. */
  HEAL_GLOW_MS: 950,
  /** Larger wind-up pause specifically for power_strike's heavy burst — more drama before impact. */
  POWER_STRIKE_ANTICIPATION_MS: 400,
} as const

/**
 * Per-skill hit impact tint — overrides the default yellow impact graphic.
 * 'counter' is a pseudo-skill key for the counter_stance payoff hit.
 * Skills not listed fall back to yellow (normal attack feel).
 */
export const SKILL_IMPACT_COLOR: Record<string, { stroke: string; glowFilter: string }> = {
  triple_hit: {
    stroke: '#bae6fd',
    glowFilter: 'drop-shadow(0 0 6px rgba(186,230,253,0.92)) drop-shadow(0 0 11px rgba(56,189,248,0.62))',
  },
  overdrive: {
    stroke: '#e879f9',
    glowFilter: 'drop-shadow(0 0 7px rgba(232,121,249,0.92)) drop-shadow(0 0 13px rgba(217,70,239,0.62))',
  },
  power_strike: {
    stroke: '#fb923c',
    glowFilter: 'drop-shadow(0 0 7px rgba(251,146,60,0.92)) drop-shadow(0 0 13px rgba(234,88,12,0.62))',
  },
  charge_strike: {
    stroke: '#fbbf24',
    glowFilter: 'drop-shadow(0 0 8px rgba(251,191,36,0.95)) drop-shadow(0 0 15px rgba(245,158,11,0.65))',
  },
  counter_stance: {
    stroke: '#7dd3fc',
    glowFilter: 'drop-shadow(0 0 7px rgba(125,211,252,0.92)) drop-shadow(0 0 12px rgba(14,165,233,0.62))',
  },
}
