import { BATTLE_ANIM, SKILL_VISUAL_IDENTITY } from '@/lib/battleAnimationConfig'
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
  | { type: 'effect'; target: BattleAnimationTarget; effect: string; payload?: unknown }
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

function didPlayerOverdriveActivate(opts: BattleAnimationPlanOptions, entry: BattleLogEntry, entryIndex: number) {
  if (entry.skillId !== 'overdrive') return false
  if (entry.actor !== 'player') return true

  return getPlayerFocusPipsBeforeEntry(
    opts.base,
    opts.newEntries,
    entryIndex,
    opts.playerPipCap,
    opts.playerFocusGain,
  ) >= getBattleSkillPipCost('overdrive')
}

function getSkillAnticipationMs(skillId: string | null) {
  if (skillId === 'power_strike') return BATTLE_ANIM.POWER_STRIKE_ANTICIPATION_MS
  if (skillId === 'charge_strike') return BATTLE_ANIM.HEAVY_SKILL_ANTICIPATION_MS
  return BATTLE_ANIM.ATTACK_ANTICIPATION_MS
}

function getSkillImpactProfile(skillId: string | null) {
  const isPowerStrike = skillId === 'power_strike'
  const isChargeStrike = skillId === 'charge_strike'
  const isOverdrive = skillId === 'overdrive'
  const isTripleHit = skillId === 'triple_hit'
  const isSingleHit = isPowerStrike || isChargeStrike
  const hitCount = isOverdrive ? 5 : 3
  const hitSpacingMs = isOverdrive
    ? BATTLE_ANIM.OVERDRIVE_HIT_SPACING_MS
    : BATTLE_ANIM.FOCUSED_HIT_SPACING_MS

  return {
    isPowerStrike,
    isChargeStrike,
    isOverdrive,
    isTripleHit,
    isSingleHit,
    hitCount,
    hitSpacingMs,
    anticipationMs: getSkillAnticipationMs(skillId),
  }
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

function addPlayerSkillPipSpend(
  events: ScheduledBattleAnimationEvent[],
  opts: BattleAnimationPlanOptions,
  entry: BattleLogEntry,
  entryIndex: number,
  entryStartMs: number,
) {
  if (entry.phase !== 'action' || entry.action !== 'skill' || entry.actor !== 'player') return 0

  const skillId = entry.skillId ?? ''
  const pipCost = getBattleSkillPipCost(skillId)
  const pipsBeforeSkill = getPlayerFocusPipsBeforeEntry(
    opts.base,
    opts.newEntries,
    entryIndex,
    opts.playerPipCap,
    opts.playerFocusGain,
  )
  const pipSpendCount = doesBattleSkillSpendAllPips(skillId)
    ? Math.max(pipCost, pipsBeforeSkill)
    : pipCost

  add(events, entryStartMs, {
    type: 'effect',
    target: 'player',
    effect: skillId === 'charge_strike' ? 'charge_strike_spend' : 'focus_spend',
    payload: { count: pipSpendCount },
  })
  add(events, entryStartMs + BATTLE_ANIM.SKILL_PIP_DEPLETION_DELAY_MS, {
    type: 'resolve_log_entry',
    entryIndex,
    mode: 'pip_spend_only',
  })
  return BATTLE_ANIM.SKILL_PIP_SPEND_LEAD_MS
}

function getPriorPlayerHp(opts: BattleAnimationPlanOptions, entryIndex: number) {
  const priorEntries = [...opts.base, ...opts.newEntries.slice(0, entryIndex)]
  return priorEntries.reduceRight<number | null>((found, e) => {
    if (found !== null) return found
    return e.target === 'player' && e.targetHpAfter !== null ? e.targetHpAfter : null
  }, null) ?? opts.playerMaxHp
}

function addContactEffects(
  events: ScheduledBattleAnimationEvent[],
  atMs: number,
  entry: BattleLogEntry,
  effectKind: 'basic' | 'heavy_skill' | 'focused_skill' | 'counter',
  payload: Record<string, unknown> = {},
  arenaFeedback: 'none' | 'normal' | 'heavy' = 'normal',
  guardImpactIntensity: 'normal' | 'heavy' = entry.crit ? 'heavy' : 'normal',
) {
  if (!isBattleTarget(entry.target)) return
  if (entry.defended && targetChoseDefend(entry)) {
    add(events, atMs, {
      type: 'effect',
      target: entry.target,
      effect: 'guard_impact',
      payload: { intensity: guardImpactIntensity },
    })
  }
  add(events, atMs, { type: 'sprite_hurt', target: entry.target, crit: entry.crit, ...payload })
  add(events, atMs, {
    type: 'effect',
    target: entry.target,
    effect: effectKind,
    payload: {
      damage: entry.damage,
      crit: entry.crit,
      ...payload,
    },
  })
  if (entry.target === 'player') {
    add(events, atMs, { type: 'effect', target: 'player', effect: 'hide_persistent_guard' })
  }
  if (arenaFeedback !== 'none') {
    add(events, atMs, { type: 'arena_shake', heavy: arenaFeedback === 'heavy' })
    add(events, atMs, { type: 'arena_flash' })
  }
}

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
      add(events, entryStartMs, { type: 'effect', target: 'player', effect: 'hide_persistent_guard' })
    }

    if (entry.action === 'special') {
      add(events, entryStartMs, { type: 'effect', target: 'player', effect: 'special_flash' })
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
        target: entry.actor,
        effect: 'defend_guard',
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
        target: entry.actor,
        effect: 'focus_charge',
      })
      addResolve(
        events,
        entryStartMs,
        entryIndex,
        BATTLE_ANIM.SUPPORT_ANTICIPATION_MS + BATTLE_ANIM.FOCUS_CHARGE_MS,
      )
    }

    if (entry.phase === 'action' && entry.action === 'attack' && entry.damage > 0 && isBattleActor(entry.actor)) {
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
        'basic',
        {},
        entry.crit ? 'heavy' : 'none',
      )
      addFaintAfterHit(
        events,
        entryStartMs + contactMs,
        entry,
        entry.crit ? BATTLE_ANIM.HURT_CRIT_MS : BATTLE_ANIM.HURT_MS,
      )
    }

    if (entry.phase === 'action' && entry.action === 'skill' && entry.skillId === 'counter_stance') {
      const skillLeadMs = addPlayerSkillPipSpend(events, opts, entry, entryIndex, entryStartMs)
      if (isBattleActor(entry.actor)) {
        add(events, entryStartMs + skillLeadMs, {
          type: 'sprite_anticipation',
          actor: entry.actor,
          durationMs: BATTLE_ANIM.SUPPORT_ANTICIPATION_MS,
        })
      }
      addResolve(events, entryStartMs, entryIndex, skillLeadMs + BATTLE_ANIM.SUPPORT_ANTICIPATION_MS)
      add(events, entryStartMs + skillLeadMs + BATTLE_ANIM.SUPPORT_ANTICIPATION_MS, {
        type: 'effect',
        target: 'player',
        effect: 'persistent_guard',
      })
    }

    if (
      entry.phase === 'action'
      && entry.action === 'skill'
      && entry.skillId === 'regen'
      && entry.targetHpAfter !== null
    ) {
      const targetHpAfter = entry.targetHpAfter
      const skillLeadMs = addPlayerSkillPipSpend(events, opts, entry, entryIndex, entryStartMs)
      if (isBattleActor(entry.actor)) {
        add(events, entryStartMs + skillLeadMs, {
          type: 'sprite_anticipation',
          actor: entry.actor,
          durationMs: BATTLE_ANIM.SUPPORT_ANTICIPATION_MS,
        })
      }
      const regenAtMs = entryStartMs + skillLeadMs + BATTLE_ANIM.SUPPORT_ANTICIPATION_MS
      const healAmount = Math.max(0, targetHpAfter - getPriorPlayerHp(opts, entryIndex))
      add(events, regenAtMs, {
        type: 'effect',
        target: 'player',
        effect: 'regen',
        payload: { healAmount },
      })
      addResolve(
        events,
        entryStartMs,
        entryIndex,
        skillLeadMs + BATTLE_ANIM.SUPPORT_ANTICIPATION_MS + BATTLE_ANIM.REGEN_NUMBER_DELAY_MS,
      )
    }

    if (entry.phase === 'action' && entry.action === 'skill' && entry.damage > 0) {
      const skillLeadMs = addPlayerSkillPipSpend(events, opts, entry, entryIndex, entryStartMs)
      const {
        isPowerStrike,
        isChargeStrike,
        isOverdrive,
        isTripleHit,
        isSingleHit,
        hitCount,
        hitSpacingMs,
        anticipationMs,
      } = getSkillImpactProfile(entry.skillId)

      if (isChargeStrike) {
        add(events, entryStartMs + skillLeadMs, {
          type: 'effect',
          target: entry.actor === 'opponent' ? 'opponent' : 'player',
          effect: 'charge_glow',
        })
      }

      const lungeStartMs = entryStartMs
        + skillLeadMs
        + (isChargeStrike ? BATTLE_ANIM.CHARGE_GLOW_MS : 0)
      const contactDelayMs = anticipationMs + BATTLE_ANIM.LUNGE_PEAK_MS
      const contactAtMs = lungeStartMs + contactDelayMs
      const skillVisual = entry.skillId ? SKILL_VISUAL_IDENTITY[entry.skillId] : undefined
      const skillFlash = entry.actor === 'player' ? skillVisual?.flash : undefined
      if (skillFlash) {
        add(events, lungeStartMs, {
          type: 'effect',
          target: 'player',
          effect: 'special_flash',
          payload: { color: skillFlash },
        })
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
        addContactEffects(events, contactAtMs, entry, 'heavy_skill', {
          tint: skillVisual?.impact,
          shockwaveColor: skillVisual?.shockwave,
          groundShockwaveHeavy: isPowerStrike,
        }, isPowerStrike || entry.crit ? 'heavy' : 'normal', isPowerStrike || entry.crit ? 'heavy' : 'normal')
        addFaintAfterHit(
          events,
          contactAtMs,
          entry,
          entry.crit ? BATTLE_ANIM.HURT_CRIT_MS : BATTLE_ANIM.HURT_MS,
        )
      } else {
        const finalHitDelayMs = hitSpacingMs * (hitCount - 1)
        addContactEffects(events, contactAtMs, entry, 'focused_skill', {
          hitCount,
          spacingMs: hitSpacingMs,
          damageDelayMs: finalHitDelayMs,
          finalHitDurationMs: entry.crit ? BATTLE_ANIM.HURT_CRIT_MS : BATTLE_ANIM.HURT_MS,
          impactVariant: isTripleHit ? 'cut' : 'arc',
          tint: skillVisual?.impact,
        }, 'none')
        add(events, contactAtMs + finalHitDelayMs, { type: 'arena_shake', heavy: entry.crit })
        add(events, contactAtMs + finalHitDelayMs, { type: 'arena_flash' })
        if (isOverdrive && didPlayerOverdriveActivate(opts, entry, entryIndex) && isBattleTarget(entry.target)) {
          for (let hit = 0; hit < hitCount; hit += 1) {
            add(events, contactAtMs + (hit * hitSpacingMs), {
              type: 'effect',
              target: entry.target,
              effect: 'overdrive_streak',
              payload: { streakColor: skillVisual?.streak },
            })
          }
        }
        addFaintAfterHit(
          events,
          contactAtMs,
          entry,
          finalHitDelayMs + BATTLE_ANIM.HIT_IMPACT_MS,
        )
      }
    }

    const playerAlreadyDead = opts.newEntries
      .slice(0, entryIndex)
      .some(e => e.target === 'player' && e.targetHpAfter === 0)
    if (entry.action === 'counter' && entry.damage > 0 && !playerAlreadyDead) {
      add(events, entryStartMs, { type: 'effect', target: 'player', effect: 'hide_persistent_guard' })
      addResolve(events, entryStartMs, entryIndex)
      add(events, entryStartMs, { type: 'sprite_hurt', target: 'opponent', crit: false })
      add(events, entryStartMs, {
        type: 'effect',
        target: 'opponent',
        effect: 'counter',
        payload: {
          damage: entry.damage,
          crit: false,
          tint: SKILL_VISUAL_IDENTITY.counter_stance.impact,
        },
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
