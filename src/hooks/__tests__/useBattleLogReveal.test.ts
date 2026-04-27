import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CreatureSpriteHandle } from '@/components/ui/CreatureSprite'
import type { EffectsLayerHandle } from '@/components/ui/EffectsLayer'
import type { SpecialActionFlashHandle } from '@/components/ui/SpecialActionFlash'
import { useBattleLogReveal } from '../useBattleLogReveal'
import type { BattleLogEntry } from '@/types/domain'

function entry(overrides: Partial<BattleLogEntry>): BattleLogEntry {
  return {
    id: 'entry-1',
    round: 1,
    phase: 'action',
    actor: 'player',
    action: 'attack',
    damage: 0,
    target: null,
    targetHpAfter: null,
    crit: false,
    defended: false,
    consumedMomentumBoost: false,
    consumedNextAttackBonus: false,
    message: 'Test entry',
    ...overrides,
  }
}

function effectHandle(): EffectsLayerHandle {
  return {
    showDamageNumber: vi.fn(),
    showCritBadge: vi.fn(),
    showAttackImpact: vi.fn(),
    showFocusedAttackImpact: vi.fn(),
    showHitImpact: vi.fn(),
    showDefendGuard: vi.fn(),
    showFocusCharge: vi.fn(),
  }
}

describe('useBattleLogReveal', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('routes defend and focus effects to the acting sprite layer', () => {
    vi.useFakeTimers()
    const playerEffects = effectHandle()
    const opponentEffects = effectHandle()
    const { result } = renderHook(() =>
      useBattleLogReveal({
        playerSpriteRef: { current: { triggerAnimation: vi.fn() } satisfies CreatureSpriteHandle },
        opponentSpriteRef: { current: { triggerAnimation: vi.fn() } satisfies CreatureSpriteHandle },
        playerEffectsRef: { current: playerEffects },
        opponentEffectsRef: { current: opponentEffects },
        triggerArenaShake: vi.fn(),
        specialFlashRef: { current: { triggerFlash: vi.fn() } satisfies SpecialActionFlashHandle },
      }),
    )

    act(() => {
      result.current.revealEntries('run-1', [
        entry({ id: 'defend-1', actor: 'player', action: 'defend' }),
        entry({ id: 'focus-1', actor: 'opponent', action: 'focus' }),
      ], [])
      vi.advanceTimersByTime(1200)
    })

    expect(playerEffects.showDefendGuard).toHaveBeenCalledTimes(1)
    expect(opponentEffects.showFocusCharge).toHaveBeenCalledTimes(1)
    expect(opponentEffects.showDefendGuard).not.toHaveBeenCalled()
    expect(playerEffects.showFocusCharge).not.toHaveBeenCalled()
  })

  it('keeps attack damage behavior on the target sprite layer', () => {
    vi.useFakeTimers()
    const opponentSprite = { triggerAnimation: vi.fn() } satisfies CreatureSpriteHandle
    const opponentEffects = effectHandle()
    const triggerArenaShake = vi.fn()
    const { result } = renderHook(() =>
      useBattleLogReveal({
        playerSpriteRef: { current: { triggerAnimation: vi.fn() } satisfies CreatureSpriteHandle },
        opponentSpriteRef: { current: opponentSprite },
        playerEffectsRef: { current: effectHandle() },
        opponentEffectsRef: { current: opponentEffects },
        triggerArenaShake,
        specialFlashRef: { current: { triggerFlash: vi.fn() } satisfies SpecialActionFlashHandle },
      }),
    )

    act(() => {
      result.current.revealEntries('run-1', [
        entry({
          id: 'attack-1',
          actor: 'player',
          action: 'attack',
          damage: 18,
          target: 'opponent',
          targetHpAfter: 30,
          crit: true,
        }),
      ], [])
      vi.advanceTimersByTime(0)
    })

    expect(opponentSprite.triggerAnimation).toHaveBeenCalledWith('hurt', expect.any(Number), true)
    expect(opponentEffects.showDamageNumber).toHaveBeenCalledWith(18, true)
    expect(opponentEffects.showAttackImpact).toHaveBeenCalledWith(true)
    expect(opponentEffects.showCritBadge).toHaveBeenCalledTimes(1)
    expect(triggerArenaShake).toHaveBeenCalledWith(true)
  })

  it('uses focused attack impact when attack consumes a focus charge', () => {
    vi.useFakeTimers()
    const opponentEffects = effectHandle()
    const { result } = renderHook(() =>
      useBattleLogReveal({
        playerSpriteRef: { current: { triggerAnimation: vi.fn() } satisfies CreatureSpriteHandle },
        opponentSpriteRef: { current: { triggerAnimation: vi.fn() } satisfies CreatureSpriteHandle },
        playerEffectsRef: { current: effectHandle() },
        opponentEffectsRef: { current: opponentEffects },
        triggerArenaShake: vi.fn(),
        specialFlashRef: { current: { triggerFlash: vi.fn() } satisfies SpecialActionFlashHandle },
      }),
    )

    act(() => {
      result.current.revealEntries('run-1', [
        entry({
          id: 'focused-attack-1',
          actor: 'player',
          action: 'attack',
          damage: 42,
          target: 'opponent',
          targetHpAfter: 20,
          crit: true,
          consumedNextAttackBonus: true,
        }),
      ], [])
      vi.advanceTimersByTime(0)
    })

    expect(opponentEffects.showFocusedAttackImpact).toHaveBeenCalledWith(true)
    expect(opponentEffects.showAttackImpact).not.toHaveBeenCalled()
  })
})
