import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import BattlePage from '../BattlePage'

const useBattleRunMock = vi.fn()
const useSubmitBattleActionMock = vi.fn()

vi.mock('@/features/creature/useBattleRun', () => ({
  useBattleRun: (...args: unknown[]) => useBattleRunMock(...args),
  useSubmitBattleAction: () => useSubmitBattleActionMock(),
}))

describe('BattlePage', () => {
  it('shows opponent recommended level and companion level separately', () => {
    useBattleRunMock.mockReturnValue({
      data: {
        id: 'run-1',
        userId: 'user-1',
        battleDate: '2026-04-02',
        snapshotId: 'snapshot-1',
        opponentId: 'opp-1',
        outcome: 'pending',
        turnCount: null,
        remainingHpPct: null,
        xpAwarded: 0,
        arenaProgressAwarded: 0,
        rewardClaimed: false,
        createdAt: '2026-04-02T10:00:00.000Z',
        status: 'active',
        playerMaxHp: 104,
        playerCurrentHp: 104,
        opponentMaxHp: 78,
        opponentCurrentHp: 78,
        currentRound: 1,
        battleLog: [],
        completedAt: null,
        snapshot: {
          id: 'snapshot-1',
          userId: 'user-1',
          prepDate: '2026-04-01',
          battleDate: '2026-04-02',
          strength: 70,
          resilience: 82,
          momentum: 68,
          vitality: 104,
          readinessScore: 73,
          readinessBand: 'building',
          condition: 'steady',
          level: 7,
          stage: 'adult',
          sourceDailyEvaluationId: 'eval-1',
          xpGained: 24,
          createdAt: '2026-04-01T22:00:00.000Z',
        },
        opponent: {
          id: 'opp-1',
          arenaId: 'arena-1',
          name: 'Pebble Pup',
          archetype: 'steady bruiser',
          recommendedLevel: 2,
          strength: 42,
          resilience: 45,
          momentum: 38,
          vitality: 78,
          sortOrder: 1,
          unlockLevel: 1,
          isActive: true,
          createdAt: '2026-04-01T00:00:00.000Z',
        },
        companion: {
          userId: 'user-1',
          name: 'Sprout',
          stage: 'adult',
          level: 7,
          xp: 612,
          currentCondition: 'steady',
          hatchedAt: '2026-03-20T00:00:00.000Z',
          evolvedToAdultAt: '2026-03-28T00:00:00.000Z',
          evolvedToChampionAt: null,
          createdAt: '2026-03-20T00:00:00.000Z',
          updatedAt: '2026-04-02T10:00:00.000Z',
        },
      },
      isLoading: false,
      error: null,
    })

    useSubmitBattleActionMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    })

    render(
      <MemoryRouter initialEntries={['/app/battle/run-1']}>
        <Routes>
          <Route path="/app/battle/:battleRunId" element={<BattlePage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Pebble Pup')).toBeInTheDocument()
    expect(screen.getByText('Lv2')).toBeInTheDocument()
    expect(screen.getByText('Sprout')).toBeInTheDocument()
    expect(screen.getByText('Lv7')).toBeInTheDocument()
  })
})
