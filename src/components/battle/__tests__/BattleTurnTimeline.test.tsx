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

describe('BattleTurnTimeline', () => {
  it('shows unresolved order before initiative is revealed', () => {
    render(<BattleTurnTimeline entries={[]} companionName="Sprout" opponentName="Pebble Pup" />)

    expect(screen.getByLabelText('Turn order')).toHaveTextContent('Player')
    expect(screen.getByLabelText('Turn order')).toHaveTextContent('?')
    expect(screen.getByLabelText('Turn order')).toHaveTextContent('Opponent')
  })

  it('renders player-first initiative order', () => {
    render(
      <BattleTurnTimeline
        companionName="Sprout"
        opponentName="Pebble Pup"
        entries={[
          entry({
            id: 'initiative-1',
            phase: 'initiative',
            actor: 'system',
            action: 'initiative',
            firstActor: 'player',
            playerInitiative: 17,
            opponentInitiative: 12,
            playerAction: 'attack',
            opponentAction: 'defend',
          }),
        ]}
      />,
    )

    expect(screen.getByLabelText('Turn order')).toHaveTextContent('Sprout')
    expect(screen.getByLabelText('Turn order')).toHaveTextContent('Attack')
    expect(screen.getByLabelText('Turn order')).toHaveTextContent('17')
    expect(screen.getByLabelText('Turn order')).toHaveTextContent('Pebble Pup')
    expect(screen.getByLabelText('Turn order')).toHaveTextContent('Defend')
    expect(screen.getByLabelText('Turn order')).toHaveTextContent('12')
  })

  it('renders opponent-first initiative order', () => {
    render(
      <BattleTurnTimeline
        companionName="Sprout"
        opponentName="Pebble Pup"
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

    expect(screen.getByLabelText('Turn order')).toHaveTextContent('Pebble Pup')
    expect(screen.getByLabelText('Turn order')).toHaveTextContent('Special')
    expect(screen.getByLabelText('Turn order')).toHaveTextContent('14')
    expect(screen.getByLabelText('Turn order')).toHaveTextContent('Sprout')
    expect(screen.getByLabelText('Turn order')).toHaveTextContent('Focus')
    expect(screen.getByLabelText('Turn order')).toHaveTextContent('9')
  })

  it('derives state from revealed entries only', () => {
    const revealedEntries = [
      entry({
        id: 'initiative-1',
        phase: 'initiative',
        actor: 'system',
        action: 'initiative',
        firstActor: 'player',
        playerInitiative: 17,
        opponentInitiative: 12,
      }),
      entry({ id: 'action-1', actor: 'player', action: 'attack' }),
    ]

    expect(getBattleTurnTimelineState(revealedEntries)).toEqual({
      initiative: revealedEntries[0],
      activeActor: 'player',
    })
  })
})
