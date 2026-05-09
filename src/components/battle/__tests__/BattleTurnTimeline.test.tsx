import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BattleTurnTimeline } from '../BattleTurnTimeline'
import { getBattleTurnTimelineState } from '../battleTurnTimelineModel'
import type { BattleLogEntry } from '@/types/domain'

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

const initiativeEntry = entry({
  id: 'initiative-1',
  phase: 'initiative',
  actor: 'system',
  action: 'initiative',
  firstActor: 'player',
  playerInitiative: 17,
  opponentInitiative: 12,
  playerAction: 'attack',
  opponentAction: 'defend',
})

describe('BattleTurnTimeline', () => {
  it('shows both chips with ? connector before initiative is revealed', () => {
    render(<BattleTurnTimeline entries={[]} companionName="Sprout" opponentName="Pebble Pup" />)
    const el = screen.getByLabelText('Turn order')
    expect(el).toHaveTextContent('SP')
    expect(el).toHaveTextContent('PP')
    expect(el).toHaveTextContent('?')
  })

  it('renders player-first initiative order with initials', () => {
    render(
      <BattleTurnTimeline
        companionName="Sprout"
        opponentName="Pebble Pup"
        entries={[initiativeEntry]}
      />,
    )
    const el = screen.getByLabelText('Turn order')
    // player = "SP", opponent = "PP"
    expect(el).toHaveTextContent('SP')
    expect(el).toHaveTextContent('PP')
  })

  it('renders opponent-first initiative order', () => {
    render(
      <BattleTurnTimeline
        companionName="Sprout"
        opponentName="Cinder Finch"
        entries={[
          entry({
            id: 'initiative-1',
            phase: 'initiative',
            actor: 'system',
            action: 'initiative',
            firstActor: 'opponent',
            playerInitiative: 9,
            opponentInitiative: 14,
            playerAction: 'focus',
            opponentAction: 'special',
          }),
        ]}
      />,
    )
    const el = screen.getByLabelText('Turn order')
    // "Cinder Finch" → "CF", "Sprout" → "SP"
    expect(el).toHaveTextContent('CF')
    expect(el).toHaveTextContent('SP')
  })

  it('highlights first actor before any action this round', () => {
    expect(getBattleTurnTimelineState([initiativeEntry])).toMatchObject({
      initiative: initiativeEntry,
      activeActor: 'player',
    })
  })

  it('shifts highlight to second actor once first has acted', () => {
    const opponentAction = entry({ id: 'action-2', round: 1, phase: 'action', actor: 'opponent' })
    const displayed = [
      initiativeEntry,
      entry({ id: 'action-1', round: 1, phase: 'action', actor: 'player' }),
    ]
    const full = [...displayed, opponentAction]
    expect(getBattleTurnTimelineState(displayed, full)).toMatchObject({ activeActor: 'opponent' })
  })

  it('resets to null after both actors have acted', () => {
    const entries = [
      initiativeEntry,
      entry({ id: 'action-1', round: 1, phase: 'action', actor: 'player' }),
      entry({ id: 'action-2', round: 1, phase: 'action', actor: 'opponent' }),
    ]
    expect(getBattleTurnTimelineState(entries).activeActor).toBeNull()
  })

  it('highlights new first actor at start of next round', () => {
    const round2Initiative = entry({
      id: 'initiative-2',
      round: 2,
      phase: 'initiative',
      actor: 'system',
      action: 'initiative',
      firstActor: 'opponent',
      playerInitiative: 11,
      opponentInitiative: 14,
      playerAction: 'defend',
      opponentAction: 'attack',
    })
    const entries = [
      initiativeEntry,
      entry({ id: 'action-1', round: 1, phase: 'action', actor: 'player' }),
      entry({ id: 'action-2', round: 1, phase: 'action', actor: 'opponent' }),
      round2Initiative,
    ]
    const state = getBattleTurnTimelineState(entries)
    expect(state.activeActor).toBe('opponent')
    expect(state.initiative?.id).toBe('initiative-2')
  })

  it('detects skipped actor when fullLog has no second-actor action', () => {
    // displayed log shows player acted, full log has no opponent action in round 1
    const displayed = [initiativeEntry, entry({ id: 'action-1', actor: 'player', round: 1 })]
    const full = [...displayed] // no opponent action

    const state = getBattleTurnTimelineState(displayed, full)
    expect(state.skippedActor).toBe('opponent')
  })

  it('does not mark skipped when fullLog has second-actor action', () => {
    const displayed = [initiativeEntry, entry({ id: 'action-1', actor: 'player', round: 1 })]
    const full = [
      ...displayed,
      entry({ id: 'action-2', actor: 'opponent', round: 1, phase: 'action' }),
    ]

    const state = getBattleTurnTimelineState(displayed, full)
    expect(state.skippedActor).toBeNull()
  })
})
