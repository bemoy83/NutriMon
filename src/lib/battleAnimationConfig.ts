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
/** Hit impact PNG scale/rotate animation duration (ms). Must match `hit-impact` @keyframes. */
  HIT_IMPACT_MS: 350,
  /** Time between focused attack hit starts (ms). Used by both impact sprites and target hit flashes. */
  FOCUSED_HIT_SPACING_MS: 180,
  /** Faster hit cadence for overdrive's five-hit sequence. */
  OVERDRIVE_HIT_SPACING_MS: 115,
  /** Shield dome duration (ms). Must match `shield-dome-in` @keyframes. */
  DEFEND_GUARD_MS: 900,
  /** One-shot shield contact reaction for defended hits. */
  GUARD_IMPACT_MS: 360,
  /** Focus charge effect total duration (ms). Covers mote orbit (640ms) + shrink rings + burst out (620+220ms). */
  FOCUS_CHARGE_MS: 860,
  /** Delay before the HUD pip count depletes during player skill activation. */
  SKILL_PIP_DEPLETION_DELAY_MS: 120,

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

export interface SkillImpactVisual {
  stroke: string
  glowFilter: string
}

export interface SkillShockwaveVisual {
  stroke: string
  glow: string
  deepGlow: string
}

export interface SkillStreakVisual {
  background: string
}

const DEFAULT_AMBER_SHOCKWAVE: SkillShockwaveVisual = {
  stroke: 'rgba(250,204,21,0.92)',
  glow: 'rgba(250,204,21,0.72)',
  deepGlow: 'rgba(245,158,11,0.46)',
}

const AMBER_HIT_IMPACT: SkillImpactVisual = {
  stroke: '#fbbf24',
  glowFilter: 'drop-shadow(0 0 8px rgba(251,191,36,0.95)) drop-shadow(0 0 15px rgba(245,158,11,0.65))',
}

const BRIGHT_AMBER_HIT_IMPACT: SkillImpactVisual = {
  stroke: '#fde047',
  glowFilter: 'drop-shadow(0 0 8px rgba(253,224,71,0.96)) drop-shadow(0 0 16px rgba(251,191,36,0.68))',
}

export type ImpactVariant = 'slash' | 'arc' | 'burst' | 'cut'

export type SkillAnimationKind = 'single_hit' | 'multi_hit' | 'support_guard' | 'support_heal'

/**
 * Primitive effect identifiers that can be layered onto a skill at contact time via `extraEffects`.
 * Each value must correspond to a typed BattleAnimationEvent kind with a dispatch case in the conductor.
 * 'ground_shockwave' is deferred — currently bundled inside the heavy_impact event.
 */
export type EffectPrimitive = 'overdrive_streak' | 'persistent_guard' | string

export interface SkillAnimationEntry {
  // Behavioral
  kind: SkillAnimationKind
  /** Pre-lunge wind-up duration. Defaults to BATTLE_ANIM.ATTACK_ANTICIPATION_MS. */
  anticipationMs?: number
  /** Heavy anticipation pose + heavy shockwave + heavy arena feedback. */
  heavy?: boolean
  /** Fires charge_glow on the attacker's sprite stage before the lunge. */
  hasChargeGlow?: boolean
  // multi_hit only
  hitCount?: number
  hitSpacingMs?: number
  impactVariant?: ImpactVariant
  /** Fire overdrive_streak effect on each hit beat. */
  hasStreaks?: boolean
  /** Only fire streaks when the player had enough pips to activate the skill. */
  streakRequiresPipCheck?: boolean
  /** Extra delay after SUPPORT_ANTICIPATION_MS before the entry resolves. Defaults to 0. */
  resolveDelayMs?: number
  /** Additional effect primitives fired once at contact time, after the base impact event. */
  extraEffects?: EffectPrimitive[]
  // Visual — 'counter_stance' impact also colors the counter payoff hit
  impact: SkillImpactVisual
  /** Low-alpha full-screen wash for player skill starts. */
  flash: string
  shockwave?: SkillShockwaveVisual
  streak?: SkillStreakVisual
}

export const SKILL_ANIMATION_CATALOG: Partial<Record<string, SkillAnimationEntry>> = {
  power_strike: {
    kind: 'single_hit',
    anticipationMs: BATTLE_ANIM.POWER_STRIKE_ANTICIPATION_MS,
    heavy: true,
    impact: AMBER_HIT_IMPACT,
    flash: 'rgba(139,92,246,0.28)',
    shockwave: { stroke: 'rgba(251,191,36,0.95)', glow: 'rgba(251,191,36,0.74)', deepGlow: 'rgba(234,88,12,0.48)' },
  },
  charge_strike: {
    kind: 'single_hit',
    anticipationMs: BATTLE_ANIM.HEAVY_SKILL_ANTICIPATION_MS,
    hasChargeGlow: true,
    impact: AMBER_HIT_IMPACT,
    flash: 'rgba(250,204,21,0.28)',
    shockwave: DEFAULT_AMBER_SHOCKWAVE,
  },
  triple_hit: {
    kind: 'multi_hit',
    hitCount: 3,
    hitSpacingMs: BATTLE_ANIM.FOCUSED_HIT_SPACING_MS,
    impactVariant: 'cut',
    impact: BRIGHT_AMBER_HIT_IMPACT,
    flash: 'rgba(251,146,60,0.22)',
    shockwave: { stroke: 'rgba(253,224,71,0.92)', glow: 'rgba(251,191,36,0.68)', deepGlow: 'rgba(14,165,233,0.38)' },
  },
  overdrive: {
    kind: 'multi_hit',
    hitCount: 5,
    hitSpacingMs: BATTLE_ANIM.OVERDRIVE_HIT_SPACING_MS,
    impactVariant: 'arc',
    hasStreaks: true,
    streakRequiresPipCheck: true,
    impact: BRIGHT_AMBER_HIT_IMPACT,
    flash: 'rgba(217,70,239,0.30)',
    shockwave: { stroke: 'rgba(253,224,71,0.92)', glow: 'rgba(251,191,36,0.68)', deepGlow: 'rgba(162,28,175,0.44)' },
    streak: { background: 'linear-gradient(90deg, transparent 0%, rgba(217,70,239,0.85) 22%, rgba(255,255,255,0.72) 50%, rgba(217,70,239,0.85) 78%, transparent 100%)' },
  },
  counter_stance: {
    kind: 'support_guard',
    impact: BRIGHT_AMBER_HIT_IMPACT,
    flash: 'rgba(14,165,233,0.22)',
    shockwave: { stroke: 'rgba(253,224,71,0.90)', glow: 'rgba(251,191,36,0.62)', deepGlow: 'rgba(2,132,199,0.38)' },
  },
  regen: {
    kind: 'support_heal',
    resolveDelayMs: BATTLE_ANIM.REGEN_NUMBER_DELAY_MS,
    impact: { stroke: '#4ade80', glowFilter: 'drop-shadow(0 0 7px rgba(74,222,128,0.9)) drop-shadow(0 0 12px rgba(34,197,94,0.58))' },
    flash: 'rgba(34,197,94,0.22)',
  },
}
