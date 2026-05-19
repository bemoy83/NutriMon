import {
  BATTLE_ANIM,
  SKILL_ANIMATION_CATALOG,
  type ImpactVariant,
  type SkillImpactVisual,
  type SkillShockwaveVisual,
  type SkillStreakVisual,
} from '@/lib/battleAnimationConfig'
import { doesBattleSkillSpendAllPips, getBattleSkillPipCost } from '@/lib/battleSkills'
import type { BattleLogEntry } from '@/types/domain'

export type BattleAnimationActor = 'player' | 'opponent'
export type BattleAnimationTarget = 'player' | 'opponent'

export type BattleAnimationEvent =
  | { type: 'reveal_log_entry'; entryIndex: number }
  | { type: 'resolve_log_entry'; entryIndex: number; mode?: 'full' | 'pip_spend_only' }
  | { type: 'sprite_anticipation'; actor: BattleAnimationActor; durationMs: number; heavy?: boolean }
  | { type: 'sprite_attack'; actor: BattleAnimationActor }
  | {
      type: 'sprite_hurt'
      target: BattleAnimationTarget
      crit: boolean
      hitCount?: number
      spacingMs?: number
      finalHitDurationMs?: number
    }
  | { type: 'sprite_faint'; target: BattleAnimationTarget }
  // Effect events — discriminated by `kind`, each with exactly the params it needs
  | { type: 'effect'; kind: 'defend_guard'; target: BattleAnimationTarget }
  | { type: 'effect'; kind: 'guard_impact'; target: BattleAnimationTarget; intensity: 'normal' | 'heavy' }
  | { type: 'effect'; kind: 'focus_charge'; target: BattleAnimationTarget }
  | { type: 'effect'; kind: 'persistent_guard' }
  | { type: 'effect'; kind: 'hide_persistent_guard' }
  | { type: 'effect'; kind: 'charge_glow'; target: BattleAnimationTarget }
  | { type: 'effect'; kind: 'regen'; healAmount: number }
  | { type: 'effect'; kind: 'flash'; color?: string }
  | { type: 'effect'; kind: 'basic_impact'; target: BattleAnimationTarget; crit: boolean; damage: number }
  | {
      type: 'effect'
      kind: 'heavy_impact'
      target: BattleAnimationTarget
      crit: boolean
      damage: number
      tint?: SkillImpactVisual
      shockwaveColor?: SkillShockwaveVisual
      groundShockwaveHeavy?: boolean
    }
  | {
      type: 'effect'
      kind: 'focused_impact'
      target: BattleAnimationTarget
      crit: boolean
      damage: number
      hitCount: number
      spacingMs: number
      damageDelayMs: number
      finalHitDurationMs: number
      impactVariant?: ImpactVariant
      tint?: SkillImpactVisual
      hitBreakdown?: Array<{ damage: number; crit: boolean }>
    }
  | { type: 'effect'; kind: 'overdrive_streak'; target: BattleAnimationTarget; streakColor?: SkillStreakVisual }
  | { type: 'effect'; kind: 'ground_shockwave'; target: BattleAnimationTarget; wide?: boolean; color?: SkillShockwaveVisual }
  | { type: 'effect'; kind: 'counter_impact'; target: BattleAnimationTarget; damage: number; tint: SkillImpactVisual }
  | { type: 'arena_shake'; heavy?: boolean }
  | { type: 'arena_flash' }
  | { type: 'finish_animation' }

export interface ScheduledBattleAnimationEvent {
  atMs: number
  event: BattleAnimationEvent
}

export interface BattleAnimationPlanOptions {
  base: BattleLogEntry[]
  newEntries: BattleLogEntry[]
  playerMaxHp: number
  playerPipCap: number
  playerFocusGain: number
}

export function makeSkillPipSpendResolvedEntry(entry: BattleLogEntry): BattleLogEntry {
  return { ...entry, damage: 0, targetHpAfter: null }
}

export function getEntryDelayMs(entry: BattleLogEntry) {
  if (entry.phase === 'initiative') return BATTLE_ANIM.ENTRY_DELAY_INITIATIVE_MS
  if (entry.phase === 'result') return BATTLE_ANIM.ENTRY_DELAY_RESULT_MS
  if (entry.damage > 0) return BATTLE_ANIM.ENTRY_DELAY_ACTION_HIT_MS
  return BATTLE_ANIM.ENTRY_DELAY_ACTION_MS
}

function getPlayerFocusPipsBeforeEntry(
  base: BattleLogEntry[],
  newEntries: BattleLogEntry[],
  entryIndex: number,
  playerPipCap: number,
  playerFocusGain: number,
) {
  return [...base, ...newEntries.slice(0, entryIndex)].reduce((count, e) => {
    if (e.actor !== 'player' || e.phase !== 'action') return count
    if (e.action === 'focus') return Math.min(playerPipCap, count + playerFocusGain)
    if (e.action === 'skill') {
      if (doesBattleSkillSpendAllPips(e.skillId)) return 0
      return Math.max(0, count - getBattleSkillPipCost(e.skillId))
    }
    return count
  }, 0)
}

function didPlayerSkillActivateWithPips(opts: BattleAnimationPlanOptions, entry: BattleLogEntry, entryIndex: number) {
  if (entry.actor !== 'player') return true
  return getPlayerFocusPipsBeforeEntry(
    opts.base,
    opts.newEntries,
    entryIndex,
    opts.playerPipCap,
    opts.playerFocusGain,
  ) >= getBattleSkillPipCost(entry.skillId)
}

function isBattleActor(actor: BattleLogEntry['actor']): actor is BattleAnimationActor {
  return actor === 'player' || actor === 'opponent'
}

function isBattleTarget(target: BattleLogEntry['target']): target is BattleAnimationTarget {
  return target === 'player' || target === 'opponent'
}

function add(
  events: ScheduledBattleAnimationEvent[],
  atMs: number,
  event: BattleAnimationEvent,
) {
  events.push({ atMs, event })
}

function addResolve(events: ScheduledBattleAnimationEvent[], entryStartMs: number, entryIndex: number, delayMs = 0) {
  add(events, entryStartMs + delayMs, { type: 'resolve_log_entry', entryIndex })
}

function targetChoseDefend(entry: BattleLogEntry) {
  if (entry.target === 'player') return entry.playerAction === 'defend'
  if (entry.target === 'opponent') return entry.opponentAction === 'defend'
  return false
}


function getPriorPlayerHp(opts: BattleAnimationPlanOptions, entryIndex: number) {
  const priorEntries = [...opts.base, ...opts.newEntries.slice(0, entryIndex)]
  return priorEntries.reduceRight<number | null>((found, e) => {
    if (found !== null) return found
    return e.target === 'player' && e.targetHpAfter !== null ? e.targetHpAfter : null
  }, null) ?? opts.playerMaxHp
}

type ContactImpactEvent = Extract<BattleAnimationEvent, { type: 'effect'; kind: 'basic_impact' | 'heavy_impact' | 'focused_impact' }>

function addContactEffects(
  events: ScheduledBattleAnimationEvent[],
  atMs: number,
  entry: BattleLogEntry,
  impactEvent: ContactImpactEvent,
  arenaFeedback: 'none' | 'normal' | 'heavy' = 'normal',
  guardImpactIntensity: 'normal' | 'heavy' = entry.crit ? 'heavy' : 'normal',
) {
  if (entry.defended && targetChoseDefend(entry)) {
    add(events, atMs, { type: 'effect', kind: 'guard_impact', target: impactEvent.target, intensity: guardImpactIntensity })
  }
  const spriteHurtEvent: BattleAnimationEvent = impactEvent.kind === 'focused_impact'
    ? {
        type: 'sprite_hurt',
        target: impactEvent.target,
        crit: impactEvent.crit,
        hitCount: impactEvent.hitCount,
        spacingMs: impactEvent.spacingMs,
        finalHitDurationMs: impactEvent.finalHitDurationMs,
      }
    : { type: 'sprite_hurt', target: impactEvent.target, crit: impactEvent.crit }
  add(events, atMs, spriteHurtEvent)
  add(events, atMs, impactEvent)
  if (impactEvent.target === 'player') {
    add(events, atMs, { type: 'effect', kind: 'hide_persistent_guard' })
  }
  if (arenaFeedback !== 'none') {
    add(events, atMs, { type: 'arena_shake', heavy: arenaFeedback === 'heavy' })
    add(events, atMs, { type: 'arena_flash' })
  }
}

/**
 * Schedules a faint sprite event after the hit animation resolves.
 *
 * Faint delay strategies used across action paths:
 *  - basic attack / single-hit skill: HURT_CRIT_MS or HURT_MS — waits for the
 *    hurt flash to finish before the dissolve starts.
 *  - multi-hit skill: finalHitDelayMs + HIT_IMPACT_MS — waits for the last hit
 *    animation frame to peak, so all impacts are visible before the faint.
 *  - counter: HURT_MS (never critical) — same as attack, counter hits aren't crits.
 */
function addFaintAfterHit(
  events: ScheduledBattleAnimationEvent[],
  atMs: number,
  entry: BattleLogEntry,
  faintDelayMs: number,
) {
  if (entry.targetHpAfter === 0 && isBattleTarget(entry.target)) {
    add(events, atMs + faintDelayMs, { type: 'sprite_faint', target: entry.target })
  }
}

export function planBattleAnimationEvents(opts: BattleAnimationPlanOptions): ScheduledBattleAnimationEvent[] {
  const events: ScheduledBattleAnimationEvent[] = []
  let cumulativeMs = 0

  opts.newEntries.forEach((entry, entryIndex) => {
    const entryStartMs = cumulativeMs
    cumulativeMs += getEntryDelayMs(entry)

    add(events, entryStartMs, { type: 'reveal_log_entry', entryIndex })

    if (entry.target === 'player' && entry.targetHpAfter === 0) {
      add(events, entryStartMs, { type: 'effect', kind: 'hide_persistent_guard' })
    }

    if (entry.action === 'special') {
      add(events, entryStartMs, { type: 'effect', kind: 'flash' })
    }

    if (entry.phase === 'initiative' || entry.phase === 'result') {
      addResolve(events, entryStartMs, entryIndex)
    }

    if (entry.phase === 'action' && entry.action === 'defend' && isBattleActor(entry.actor)) {
      add(events, entryStartMs, {
        type: 'sprite_anticipation',
        actor: entry.actor,
        durationMs: BATTLE_ANIM.SUPPORT_ANTICIPATION_MS,
      })
      addResolve(events, entryStartMs, entryIndex, BATTLE_ANIM.SUPPORT_ANTICIPATION_MS)
      add(events, entryStartMs + BATTLE_ANIM.SUPPORT_ANTICIPATION_MS, {
        type: 'effect',
        kind: 'defend_guard',
        target: entry.actor,
      })
    }

    if (entry.phase === 'action' && entry.action === 'focus' && isBattleActor(entry.actor)) {
      add(events, entryStartMs, {
        type: 'sprite_anticipation',
        actor: entry.actor,
        durationMs: BATTLE_ANIM.SUPPORT_ANTICIPATION_MS,
      })
      add(events, entryStartMs + BATTLE_ANIM.SUPPORT_ANTICIPATION_MS, {
        type: 'effect',
        kind: 'focus_charge',
        target: entry.actor,
      })
      addResolve(
        events,
        entryStartMs,
        entryIndex,
        BATTLE_ANIM.SUPPORT_ANTICIPATION_MS + BATTLE_ANIM.FOCUS_CHARGE_MS,
      )
    }

    if (entry.phase === 'action' && entry.action === 'attack' && entry.damage > 0 && isBattleActor(entry.actor)) {
      if (!isBattleTarget(entry.target)) return
      const contactMs = BATTLE_ANIM.ATTACK_ANTICIPATION_MS + BATTLE_ANIM.LUNGE_PEAK_MS
      add(events, entryStartMs, {
        type: 'sprite_anticipation',
        actor: entry.actor,
        durationMs: BATTLE_ANIM.ATTACK_ANTICIPATION_MS,
      })
      add(events, entryStartMs + BATTLE_ANIM.ATTACK_ANTICIPATION_MS, {
        type: 'sprite_attack',
        actor: entry.actor,
      })
      addResolve(events, entryStartMs, entryIndex, contactMs)
      addContactEffects(
        events,
        entryStartMs + contactMs,
        entry,
        { type: 'effect', kind: 'basic_impact', target: entry.target, crit: entry.crit, damage: entry.damage },
        entry.crit ? 'heavy' : 'none',
      )
      addFaintAfterHit(
        events,
        entryStartMs + contactMs,
        entry,
        entry.crit ? BATTLE_ANIM.HURT_CRIT_MS : BATTLE_ANIM.HURT_MS,
      )
    }

    if (entry.phase === 'action' && entry.action === 'skill') {
      const recipe = SKILL_ANIMATION_CATALOG[entry.skillId ?? '']
      if (recipe?.kind === 'support_guard' || recipe?.kind === 'support_heal') {
        if (entry.phase === 'action' && entry.action === 'skill' && entry.actor === 'player') {
          add(events, entryStartMs + BATTLE_ANIM.SKILL_PIP_DEPLETION_DELAY_MS, {
            type: 'resolve_log_entry',
            entryIndex,
            mode: 'pip_spend_only',
          })
        }
        const effectAtMs = entryStartMs + BATTLE_ANIM.SUPPORT_ANTICIPATION_MS
        if (isBattleActor(entry.actor)) {
          add(events, entryStartMs, {
            type: 'sprite_anticipation',
            actor: entry.actor,
            durationMs: BATTLE_ANIM.SUPPORT_ANTICIPATION_MS,
          })
        }
        if (recipe.kind === 'support_guard') {
          add(events, effectAtMs, { type: 'effect', kind: 'persistent_guard' })
        } else if (entry.targetHpAfter !== null) {
          const healAmount = Math.max(0, entry.targetHpAfter - getPriorPlayerHp(opts, entryIndex))
          add(events, effectAtMs, { type: 'effect', kind: 'regen', healAmount })
        }
        addResolve(events, entryStartMs, entryIndex, BATTLE_ANIM.SUPPORT_ANTICIPATION_MS + (recipe.resolveDelayMs ?? 0))
      }
    }

    if (entry.phase === 'action' && entry.action === 'skill' && entry.damage > 0) {
      const recipe = SKILL_ANIMATION_CATALOG[entry.skillId ?? '']
      if (!recipe) return
      if (!isBattleTarget(entry.target)) return

      if (entry.actor === 'player') {
        add(events, entryStartMs + BATTLE_ANIM.SKILL_PIP_DEPLETION_DELAY_MS, {
          type: 'resolve_log_entry',
          entryIndex,
          mode: 'pip_spend_only',
        })
      }
      const anticipationMs = recipe.anticipationMs ?? BATTLE_ANIM.ATTACK_ANTICIPATION_MS
      const isSingleHit = recipe.kind === 'single_hit'

      if (recipe.hasChargeGlow) {
        add(events, entryStartMs, {
          type: 'effect',
          kind: 'charge_glow',
          target: entry.actor === 'opponent' ? 'opponent' : 'player',
        })
      }

      const lungeStartMs = entryStartMs
        + (recipe.hasChargeGlow ? BATTLE_ANIM.CHARGE_GLOW_MS : 0)
      const contactDelayMs = anticipationMs + BATTLE_ANIM.LUNGE_PEAK_MS
      const contactAtMs = lungeStartMs + contactDelayMs
      const skillVisual = entry.skillId ? SKILL_ANIMATION_CATALOG[entry.skillId] : undefined
      const skillFlash = entry.actor === 'player' ? skillVisual?.flash : undefined
      if (skillFlash) {
        add(events, lungeStartMs, { type: 'effect', kind: 'flash', color: skillFlash })
      }
      if (isBattleActor(entry.actor)) {
        add(events, lungeStartMs, {
          type: 'sprite_anticipation',
          actor: entry.actor,
          durationMs: anticipationMs,
          heavy: isSingleHit,
        })
        add(events, lungeStartMs + anticipationMs, {
          type: 'sprite_attack',
          actor: entry.actor,
        })
      }
      addResolve(events, lungeStartMs, entryIndex, contactDelayMs)

      if (isSingleHit) {
        const singleHitFeedback = recipe.shakeIntensity ?? (recipe.heavy || entry.crit ? 'heavy' : 'normal')
        addContactEffects(
          events,
          contactAtMs,
          entry,
          {
            type: 'effect',
            kind: 'heavy_impact',
            target: entry.target,
            crit: entry.crit,
            damage: entry.damage,
            tint: skillVisual?.impact,
            shockwaveColor: skillVisual?.shockwave,
            groundShockwaveHeavy: recipe.heavy,
          },
          singleHitFeedback,
          recipe.heavy || entry.crit ? 'heavy' : 'normal',
        )
        addFaintAfterHit(
          events,
          contactAtMs,
          entry,
          entry.crit ? BATTLE_ANIM.HURT_CRIT_MS : BATTLE_ANIM.HURT_MS,
        )
      } else {
        const hitCount = recipe.hitCount ?? 3
        const hitSpacingMs = recipe.hitSpacingMs ?? BATTLE_ANIM.FOCUSED_HIT_SPACING_MS
        const finalHitDelayMs = hitSpacingMs * (hitCount - 1)
        addContactEffects(
          events,
          contactAtMs,
          entry,
          {
            type: 'effect',
            kind: 'focused_impact',
            target: entry.target,
            crit: entry.crit,
            damage: entry.damage,
            hitCount,
            spacingMs: hitSpacingMs,
            damageDelayMs: finalHitDelayMs,
            finalHitDurationMs: entry.crit ? BATTLE_ANIM.HURT_CRIT_MS : BATTLE_ANIM.HURT_MS,
            impactVariant: recipe.impactVariant,
            tint: skillVisual?.impact,
            hitBreakdown: entry.hitBreakdown ?? undefined,
          },
          'none',
        )
        const multiHitFeedback = recipe.shakeIntensity ?? (entry.crit ? 'heavy' : 'normal')
        if (multiHitFeedback !== 'none') {
          add(events, contactAtMs + finalHitDelayMs, { type: 'arena_shake', heavy: multiHitFeedback === 'heavy' })
          add(events, contactAtMs + finalHitDelayMs, { type: 'arena_flash' })
        }
        if (recipe.hasStreaks) {
          const shouldFire = !recipe.streakRequiresPipCheck || didPlayerSkillActivateWithPips(opts, entry, entryIndex)
          if (shouldFire) {
            for (let hit = 0; hit < hitCount; hit += 1) {
              add(events, contactAtMs + (hit * hitSpacingMs), {
                type: 'effect',
                kind: 'overdrive_streak',
                target: entry.target,
                streakColor: skillVisual?.streak,
              })
            }
          }
        }
        addFaintAfterHit(
          events,
          contactAtMs,
          entry,
          finalHitDelayMs + BATTLE_ANIM.HIT_IMPACT_MS,
        )
      }
      for (const primitive of recipe.extraEffects ?? []) {
        switch (primitive) {
          case 'overdrive_streak':
            add(events, contactAtMs, {
              type: 'effect',
              kind: 'overdrive_streak',
              target: entry.target,
              streakColor: recipe.streak,
            })
            break
          case 'persistent_guard':
            add(events, contactAtMs, { type: 'effect', kind: 'persistent_guard' })
            break
          case 'ground_shockwave':
            add(events, contactAtMs, {
              type: 'effect',
              kind: 'ground_shockwave',
              target: entry.target,
              color: recipe.shockwave,
            })
            break
          default:
            if (import.meta.env.DEV) {
              console.warn(`[battleAnimationPlan] Unknown extraEffect primitive: "${primitive}"`)
            }
        }
      }
    }

    const playerAlreadyDead = opts.newEntries
      .slice(0, entryIndex)
      .some(e => e.target === 'player' && e.targetHpAfter === 0)
    if (entry.action === 'counter' && entry.damage > 0 && !playerAlreadyDead) {
      add(events, entryStartMs, { type: 'effect', kind: 'hide_persistent_guard' })
      addResolve(events, entryStartMs, entryIndex)
      add(events, entryStartMs, { type: 'sprite_hurt', target: 'opponent', crit: false })
      add(events, entryStartMs, {
        type: 'effect',
        kind: 'counter_impact',
        target: 'opponent',
        damage: entry.damage,
        tint: SKILL_ANIMATION_CATALOG['counter_stance']!.impact,
      })
      add(events, entryStartMs, { type: 'arena_shake', heavy: false })
      add(events, entryStartMs, { type: 'arena_flash' })
      addFaintAfterHit(events, entryStartMs, entry, BATTLE_ANIM.HURT_MS)
    }

    const faintHandledByDamageSequence =
      entry.damage > 0
      && (
        (entry.phase === 'action' && (entry.action === 'attack' || entry.action === 'skill'))
        || (entry.action === 'counter')
      )
    if (entry.targetHpAfter === 0 && !faintHandledByDamageSequence && isBattleTarget(entry.target)) {
      addResolve(events, entryStartMs, entryIndex)
      add(events, entryStartMs, { type: 'sprite_faint', target: entry.target })
    }

    if (entryIndex === opts.newEntries.length - 1) {
      add(events, entryStartMs + getEntryDelayMs(entry), { type: 'finish_animation' })
    }
  })

  return events.sort((a, b) => a.atMs - b.atMs)
}
