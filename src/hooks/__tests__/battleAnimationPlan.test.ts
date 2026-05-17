import { describe, expect, it } from 'vitest'
import { BATTLE_ANIM, SKILL_ANIMATION_CATALOG } from '@/lib/battleAnimationConfig'
import type { BattleLogEntry } from '@/types/domain'
import {
  planBattleAnimationEvents,
  type BattleAnimationEvent,
  type ScheduledBattleAnimationEvent,
} from '../battleAnimationPlan'

function entry(overrides: Partial<BattleLogEntry>): BattleLogEntry {
  return {
    id: 'entry-1',
    round: 1,
    phase: 'action',
    actor: 'player',
    action: 'attack',
    skillId: null,
    firstActor: null,
    playerInitiative: null,
    opponentInitiative: null,
    playerAction: null,
    opponentAction: null,
    damage: 0,
    target: null,
    targetHpAfter: null,
    crit: false,
    defended: false,
    consumedMomentumBoost: false,
    message: 'Test entry',
    ...overrides,
  }
}

function plan(newEntries: BattleLogEntry[], base: BattleLogEntry[] = []) {
  return planBattleAnimationEvents({
    base,
    newEntries,
    playerMaxHp: 100,
    playerPipCap: 3,
    playerFocusGain: 1,
  })
}

function findEvent(
  events: ScheduledBattleAnimationEvent[],
  type: BattleAnimationEvent['type'],
  predicate: (event: BattleAnimationEvent) => boolean = () => true,
) {
  return events.find(({ event }) => event.type === type && predicate(event))
}

function findEffect(events: ScheduledBattleAnimationEvent[], kind: string) {
  return events.find(({ event }) => event.type === 'effect' && event.kind === kind)
}

function findEffects(events: ScheduledBattleAnimationEvent[], kind: string) {
  return events.filter(({ event }) => event.type === 'effect' && event.kind === kind)
}

describe('battleAnimationPlan', () => {
  it('resolves player focus only after the charge effect has finished', () => {
    const events = plan([entry({ id: 'focus-1', actor: 'player', action: 'focus' })])

    expect(events).toEqual(expect.arrayContaining([
      { atMs: 0, event: { type: 'reveal_log_entry', entryIndex: 0 } },
      {
        atMs: 0,
        event: {
          type: 'sprite_anticipation',
          actor: 'player',
          durationMs: BATTLE_ANIM.SUPPORT_ANTICIPATION_MS,
        },
      },
      {
        atMs: BATTLE_ANIM.SUPPORT_ANTICIPATION_MS,
        event: { type: 'effect', kind: 'focus_charge', target: 'player' },
      },
      {
        atMs: BATTLE_ANIM.SUPPORT_ANTICIPATION_MS + BATTLE_ANIM.FOCUS_CHARGE_MS,
        event: { type: 'resolve_log_entry', entryIndex: 0 },
      },
      { atMs: BATTLE_ANIM.ENTRY_DELAY_ACTION_MS, event: { type: 'finish_animation' } },
    ]))
  })

  it('resolves regen pips before HP and resolves HP when the heal number appears', () => {
    const previousEntry = entry({
      id: 'damage-before-regen',
      actor: 'opponent',
      action: 'attack',
      damage: 30,
      target: 'player',
      targetHpAfter: 70,
    })
    const regenEntry = entry({
      id: 'regen-1',
      actor: 'player',
      action: 'skill',
      skillId: 'regen',
      target: 'player',
      targetHpAfter: 78,
    })
    const events = plan([regenEntry], [previousEntry])

    expect(findEffect(events, 'pip_spend')).toMatchObject({ atMs: 0, event: { count: 2, variant: 'focus' } })
    expect(findEvent(events, 'resolve_log_entry', event => event.type === 'resolve_log_entry' && event.mode === 'pip_spend_only'))
      .toMatchObject({ atMs: BATTLE_ANIM.SKILL_PIP_DEPLETION_DELAY_MS })
    expect(findEffect(events, 'regen')).toMatchObject({
      atMs: BATTLE_ANIM.SKILL_PIP_SPEND_LEAD_MS + BATTLE_ANIM.SUPPORT_ANTICIPATION_MS,
      event: { healAmount: 8 },
    })
    expect(findEvent(events, 'resolve_log_entry', event => event.type === 'resolve_log_entry' && event.mode !== 'pip_spend_only'))
      .toMatchObject({
        atMs: BATTLE_ANIM.SKILL_PIP_SPEND_LEAD_MS
          + BATTLE_ANIM.SUPPORT_ANTICIPATION_MS
          + BATTLE_ANIM.REGEN_NUMBER_DELAY_MS,
      })
  })

  it('spends charge strike pips before charge glow and heavy contact', () => {
    const base = [
      entry({ id: 'focus-1', actor: 'player', action: 'focus' }),
      entry({ id: 'focus-2', actor: 'player', action: 'focus' }),
      entry({ id: 'focus-3', actor: 'player', action: 'focus' }),
    ]
    const events = plan([
      entry({
        id: 'charge-strike-1',
        actor: 'player',
        action: 'skill',
        skillId: 'charge_strike',
        damage: 60,
        target: 'opponent',
        targetHpAfter: 20,
      }),
    ], base)
    const lungeStartMs = BATTLE_ANIM.SKILL_PIP_SPEND_LEAD_MS + BATTLE_ANIM.CHARGE_GLOW_MS
    const contactMs = lungeStartMs + BATTLE_ANIM.HEAVY_SKILL_ANTICIPATION_MS + BATTLE_ANIM.LUNGE_PEAK_MS

    expect(findEffect(events, 'pip_spend')).toMatchObject({ atMs: 0, event: { count: 3, variant: 'charge_strike' } })
    expect(findEffect(events, 'charge_glow')).toMatchObject({ atMs: BATTLE_ANIM.SKILL_PIP_SPEND_LEAD_MS })
    expect(findEvent(events, 'sprite_anticipation')).toMatchObject({
      atMs: lungeStartMs,
      event: { durationMs: BATTLE_ANIM.HEAVY_SKILL_ANTICIPATION_MS, heavy: true },
    })
    expect(findEvent(events, 'sprite_hurt')).toMatchObject({ atMs: contactMs, event: { target: 'opponent' } })
  })

  it('models multi-hit damage as one focused contact with hit cadence metadata', () => {
    const events = plan([
      entry({
        id: 'triple-hit-1',
        actor: 'player',
        action: 'skill',
        skillId: 'triple_hit',
        damage: 42,
        target: 'opponent',
        targetHpAfter: 20,
      }),
    ])
    const contactMs = BATTLE_ANIM.SKILL_PIP_SPEND_LEAD_MS
      + BATTLE_ANIM.ATTACK_ANTICIPATION_MS
      + BATTLE_ANIM.LUNGE_PEAK_MS

    expect(findEvent(events, 'sprite_hurt')).toMatchObject({
      atMs: contactMs,
      event: {
        type: 'sprite_hurt',
        target: 'opponent',
        hitCount: 3,
        spacingMs: BATTLE_ANIM.FOCUSED_HIT_SPACING_MS,
      },
    })
    expect(findEffect(events, 'focused_impact')).toMatchObject({
      atMs: contactMs,
      event: { hitCount: 3, impactVariant: 'cut' },
    })
  })

  it('emits guard impact at contact time for defended hits only', () => {
    const defendedEvents = plan([
      entry({
        id: 'defended-hit-1',
        actor: 'opponent',
        action: 'attack',
        damage: 12,
        target: 'player',
        targetHpAfter: 88,
        defended: true,
        playerAction: 'defend',
        opponentAction: 'attack',
      }),
    ])
    const contactMs = BATTLE_ANIM.ATTACK_ANTICIPATION_MS + BATTLE_ANIM.LUNGE_PEAK_MS

    expect(findEffect(defendedEvents, 'guard_impact')).toMatchObject({
      atMs: contactMs,
      event: {
        target: 'player',
        intensity: 'normal',
      },
    })

    const plainEvents = plan([
      entry({
        id: 'plain-hit-1',
        actor: 'opponent',
        action: 'attack',
        damage: 12,
        target: 'player',
        targetHpAfter: 88,
      }),
    ])

    expect(findEffect(plainEvents, 'guard_impact')).toBeUndefined()

    const flaggedWithoutDefendEvents = plan([
      entry({
        id: 'flagged-without-defend-1',
        actor: 'opponent',
        action: 'attack',
        damage: 12,
        target: 'player',
        targetHpAfter: 88,
        defended: true,
        playerAction: 'attack',
        opponentAction: 'attack',
      }),
    ])

    expect(findEffect(flaggedWithoutDefendEvents, 'guard_impact')).toBeUndefined()
  })

  it('uses heavy guard impact for defended heavy skill contact', () => {
    const events = plan([
      entry({
        id: 'defended-power-strike-1',
        actor: 'player',
        action: 'skill',
        skillId: 'power_strike',
        damage: 20,
        target: 'opponent',
        targetHpAfter: 70,
        defended: true,
        playerAction: 'skill',
        opponentAction: 'defend',
      }),
    ])
    const contactMs = BATTLE_ANIM.SKILL_PIP_SPEND_LEAD_MS
      + BATTLE_ANIM.POWER_STRIKE_ANTICIPATION_MS
      + BATTLE_ANIM.LUNGE_PEAK_MS

    expect(findEffect(events, 'guard_impact')).toMatchObject({
      atMs: contactMs,
      event: {
        target: 'opponent',
        intensity: 'heavy',
      },
    })
  })

  it('dismisses counter stance on the incoming hit before counter payoff resolves', () => {
    const events = plan([
      entry({
        id: 'counter-stance-1',
        actor: 'player',
        action: 'skill',
        skillId: 'counter_stance',
        target: 'player',
        targetHpAfter: 80,
      }),
      entry({
        id: 'incoming-hit-1',
        actor: 'opponent',
        action: 'attack',
        damage: 20,
        target: 'player',
        targetHpAfter: 60,
      }),
      entry({
        id: 'counter-payoff-1',
        actor: 'player',
        action: 'counter',
        skillId: 'counter_stance',
        damage: 18,
        target: 'opponent',
        targetHpAfter: 40,
      }),
    ])
    const guardAtMs = BATTLE_ANIM.SKILL_PIP_SPEND_LEAD_MS + BATTLE_ANIM.SUPPORT_ANTICIPATION_MS
    const incomingHitMs = BATTLE_ANIM.ENTRY_DELAY_ACTION_MS
      + BATTLE_ANIM.ATTACK_ANTICIPATION_MS
      + BATTLE_ANIM.LUNGE_PEAK_MS
    const counterPayoffMs = BATTLE_ANIM.ENTRY_DELAY_ACTION_MS + BATTLE_ANIM.ENTRY_DELAY_ACTION_HIT_MS

    expect(findEffect(events, 'persistent_guard')).toMatchObject({ atMs: guardAtMs })
    expect(events.filter(({ event }) => event.type === 'effect' && event.kind === 'hide_persistent_guard')[0])
      .toMatchObject({ atMs: incomingHitMs })
    expect(findEffect(events, 'counter_impact')).toMatchObject({ atMs: counterPayoffMs })
    expect(incomingHitMs).toBeLessThan(counterPayoffMs)
  })

  it('waits for the final hit beat before fainting on lethal multi-hit damage', () => {
    const events = plan([
      entry({
        id: 'lethal-triple-hit-1',
        actor: 'player',
        action: 'skill',
        skillId: 'triple_hit',
        damage: 42,
        target: 'opponent',
        targetHpAfter: 0,
      }),
    ])
    const contactMs = BATTLE_ANIM.SKILL_PIP_SPEND_LEAD_MS
      + BATTLE_ANIM.ATTACK_ANTICIPATION_MS
      + BATTLE_ANIM.LUNGE_PEAK_MS
    const faintMs = contactMs
      + (BATTLE_ANIM.FOCUSED_HIT_SPACING_MS * 2)
      + BATTLE_ANIM.HIT_IMPACT_MS

    expect(findEvent(events, 'sprite_hurt')).toMatchObject({ atMs: contactMs })
    expect(findEvent(events, 'sprite_faint')).toMatchObject({
      atMs: faintMs,
      event: { type: 'sprite_faint', target: 'opponent' },
    })
  })

  it('fires extraEffects primitives at contact time after the base impact', () => {
    const catalogEntry = SKILL_ANIMATION_CATALOG['power_strike']!
    catalogEntry.extraEffects = ['persistent_guard', 'overdrive_streak']
    try {
      const events = plan([entry({
        action: 'skill',
        skillId: 'power_strike',
        damage: 50,
        target: 'opponent',
        targetHpAfter: 50,
      })])
      const contactMs = BATTLE_ANIM.SKILL_PIP_SPEND_LEAD_MS
        + BATTLE_ANIM.POWER_STRIKE_ANTICIPATION_MS
        + BATTLE_ANIM.LUNGE_PEAK_MS
      expect(findEffect(events, 'persistent_guard')).toEqual(
        expect.objectContaining({ atMs: contactMs })
      )
      expect(findEffect(events, 'overdrive_streak')).toEqual(
        expect.objectContaining({ atMs: contactMs })
      )
    } finally {
      delete catalogEntry.extraEffects
    }
  })

  it('only emits overdrive streaks when the player had enough pips to activate overdrive', () => {
    const overdriveEntry = entry({
      id: 'overdrive-1',
      actor: 'player',
      action: 'skill',
      skillId: 'overdrive',
      damage: 63,
      target: 'opponent',
      targetHpAfter: 20,
    })

    expect(findEffects(plan([overdriveEntry]), 'overdrive_streak')).toHaveLength(0)

    const events = plan([overdriveEntry], [
      entry({ id: 'focus-1', actor: 'player', action: 'focus' }),
      entry({ id: 'focus-2', actor: 'player', action: 'focus' }),
      entry({ id: 'focus-3', actor: 'player', action: 'focus' }),
    ])
    const contactMs = BATTLE_ANIM.SKILL_PIP_SPEND_LEAD_MS
      + BATTLE_ANIM.ATTACK_ANTICIPATION_MS
      + BATTLE_ANIM.LUNGE_PEAK_MS

    expect(findEffects(events, 'overdrive_streak')).toEqual([
      expect.objectContaining({ atMs: contactMs }),
      expect.objectContaining({ atMs: contactMs + BATTLE_ANIM.OVERDRIVE_HIT_SPACING_MS }),
      expect.objectContaining({ atMs: contactMs + (BATTLE_ANIM.OVERDRIVE_HIT_SPACING_MS * 2) }),
      expect.objectContaining({ atMs: contactMs + (BATTLE_ANIM.OVERDRIVE_HIT_SPACING_MS * 3) }),
      expect.objectContaining({ atMs: contactMs + (BATTLE_ANIM.OVERDRIVE_HIT_SPACING_MS * 4) }),
    ])
  })
})
