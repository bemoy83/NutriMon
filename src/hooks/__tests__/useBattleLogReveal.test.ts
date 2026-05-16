import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CreatureSpriteHandle } from '@/components/ui/CreatureSprite'
import type { EffectsLayerHandle } from '@/components/ui/EffectsLayer'
import type { SpecialActionFlashHandle } from '@/components/ui/SpecialActionFlash'
import { useBattleLogReveal } from '../useBattleLogReveal'
import type { BattleLogEntry } from '@/types/domain'
import { BATTLE_ANIM } from '@/lib/battleAnimationConfig'

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

function effectHandle(): EffectsLayerHandle {
  return {
    showDamageNumber: vi.fn(),
    showCritBadge: vi.fn(),
    showAttackImpact: vi.fn(),
    showHeavyAttackImpact: vi.fn(),
    showFocusedAttackImpact: vi.fn(),
    showGroundShockwave: vi.fn(),
    showHitImpact: vi.fn(),
    showDefendGuard: vi.fn(),
    showFocusCharge: vi.fn(),
    showFocusSpend: vi.fn(),
    showHealEffect: vi.fn(),
    showOverdriveStreak: vi.fn(),
    showRegenOrbitEffect: vi.fn(),
    showChargeStrikeSpend: vi.fn(),
    showPersistentGuard: vi.fn(),
    hidePersistentGuard: vi.fn(),
  }
}

function spriteHandle(): CreatureSpriteHandle {
  return {
    triggerAnimation: vi.fn(),
    triggerAnticipation: vi.fn(),
    triggerChargeGlow: vi.fn(),
    triggerHealGlow: vi.fn(),
    triggerFocusGlow: vi.fn(),
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
        playerSpriteRef: { current: spriteHandle() },
        opponentSpriteRef: { current: spriteHandle() },
        playerEffectsRef: { current: playerEffects },
        opponentEffectsRef: { current: opponentEffects },
        triggerArenaShake: vi.fn(),
        triggerArenaFlash: vi.fn(),
        specialFlashRef: { current: { triggerFlash: vi.fn() } satisfies SpecialActionFlashHandle },
        playerMaxHp: 100,
        playerPipCap: 3,
        playerFocusGain: 1,
      }),
    )

    act(() => {
      result.current.revealEntries('run-1', [
        entry({ id: 'defend-1', actor: 'player', action: 'defend' }),
        entry({ id: 'focus-1', actor: 'opponent', action: 'focus' }),
      ], [])
      expect(playerEffects.showDefendGuard).not.toHaveBeenCalled()
      expect(opponentEffects.showFocusCharge).not.toHaveBeenCalled()
      vi.advanceTimersByTime(BATTLE_ANIM.SUPPORT_ANTICIPATION_MS)
      expect(playerEffects.showDefendGuard).toHaveBeenCalledTimes(1)
      vi.advanceTimersByTime(BATTLE_ANIM.ENTRY_DELAY_ACTION_MS - BATTLE_ANIM.SUPPORT_ANTICIPATION_MS)
      expect(opponentEffects.showFocusCharge).not.toHaveBeenCalled()
      vi.advanceTimersByTime(BATTLE_ANIM.SUPPORT_ANTICIPATION_MS)
    })

    expect(opponentEffects.showFocusCharge).toHaveBeenCalledTimes(1)
    expect(opponentEffects.showDefendGuard).not.toHaveBeenCalled()
    expect(playerEffects.showFocusCharge).not.toHaveBeenCalled()
  })

  it('delays player focus pip resolution until the focus charge finishes', () => {
    vi.useFakeTimers()
    const playerEffects = effectHandle()
    const { result } = renderHook(() =>
      useBattleLogReveal({
        playerSpriteRef: { current: spriteHandle() },
        opponentSpriteRef: { current: spriteHandle() },
        playerEffectsRef: { current: playerEffects },
        opponentEffectsRef: { current: effectHandle() },
        triggerArenaShake: vi.fn(),
        triggerArenaFlash: vi.fn(),
        specialFlashRef: { current: { triggerFlash: vi.fn() } satisfies SpecialActionFlashHandle },
        playerMaxHp: 100,
        playerPipCap: 3,
        playerFocusGain: 1,
      }),
    )

    act(() => {
      result.current.revealEntries('run-1', [
        entry({ id: 'focus-1', actor: 'player', action: 'focus' }),
      ], [])
      vi.advanceTimersByTime(0)
    })

    expect(result.current.resolvedLogOverride?.entries).toHaveLength(0)

    act(() => {
      vi.advanceTimersByTime(BATTLE_ANIM.SUPPORT_ANTICIPATION_MS)
    })

    expect(playerEffects.showFocusCharge).toHaveBeenCalledTimes(1)
    expect(result.current.resolvedLogOverride?.entries).toHaveLength(0)

    act(() => {
      vi.advanceTimersByTime(BATTLE_ANIM.FOCUS_CHARGE_MS - 1)
    })

    expect(result.current.resolvedLogOverride?.entries).toHaveLength(0)

    act(() => {
      vi.advanceTimersByTime(1)
    })

    expect(result.current.resolvedLogOverride?.entries).toHaveLength(1)
  })

  it('delays regen HP resolution until the heal number appears', () => {
    vi.useFakeTimers()
    const playerEffects = effectHandle()
    const { result } = renderHook(() =>
      useBattleLogReveal({
        playerSpriteRef: { current: spriteHandle() },
        opponentSpriteRef: { current: spriteHandle() },
        playerEffectsRef: { current: playerEffects },
        opponentEffectsRef: { current: effectHandle() },
        triggerArenaShake: vi.fn(),
        triggerArenaFlash: vi.fn(),
        specialFlashRef: { current: { triggerFlash: vi.fn() } satisfies SpecialActionFlashHandle },
        playerMaxHp: 100,
        playerPipCap: 3,
        playerFocusGain: 1,
      }),
    )

    act(() => {
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
      result.current.revealEntries('run-1', [
        previousEntry,
        regenEntry,
      ], [previousEntry])
      vi.advanceTimersByTime(0)
    })

    expect(result.current.resolvedLogOverride?.entries).toHaveLength(1)

    act(() => {
      vi.advanceTimersByTime(BATTLE_ANIM.SKILL_PIP_SPEND_LEAD_MS)
    })

    expect(playerEffects.showFocusSpend).toHaveBeenCalledWith(2)
    expect(playerEffects.showRegenOrbitEffect).not.toHaveBeenCalled()
    expect(result.current.resolvedLogOverride?.entries).toHaveLength(2)
    expect(result.current.resolvedLogOverride?.entries[1]).toEqual(
      expect.objectContaining({ action: 'skill', skillId: 'regen', targetHpAfter: null }),
    )

    act(() => {
      vi.advanceTimersByTime(BATTLE_ANIM.SUPPORT_ANTICIPATION_MS)
    })

    expect(playerEffects.showRegenOrbitEffect).toHaveBeenCalledWith(8)
    expect(result.current.resolvedLogOverride?.entries[1]).toEqual(
      expect.objectContaining({ action: 'skill', skillId: 'regen', targetHpAfter: null }),
    )

    act(() => {
      vi.advanceTimersByTime(BATTLE_ANIM.REGEN_NUMBER_DELAY_MS - 1)
    })

    expect(result.current.resolvedLogOverride?.entries[1]).toEqual(
      expect.objectContaining({ action: 'skill', skillId: 'regen', targetHpAfter: null }),
    )

    act(() => {
      vi.advanceTimersByTime(1)
    })

    expect(result.current.resolvedLogOverride?.entries).toHaveLength(2)
  })

  it('keeps attack damage behavior on the target sprite layer', () => {
    vi.useFakeTimers()
    const playerSprite = spriteHandle()
    const opponentSprite = spriteHandle()
    const opponentEffects = effectHandle()
    const triggerArenaShake = vi.fn()
    const { result } = renderHook(() =>
      useBattleLogReveal({
        playerSpriteRef: { current: playerSprite },
        opponentSpriteRef: { current: opponentSprite },
        playerEffectsRef: { current: effectHandle() },
        opponentEffectsRef: { current: opponentEffects },
        triggerArenaShake,
        triggerArenaFlash: vi.fn(),
        specialFlashRef: { current: { triggerFlash: vi.fn() } satisfies SpecialActionFlashHandle },
        playerMaxHp: 100,
        playerPipCap: 3,
        playerFocusGain: 1,
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

    expect(playerSprite.triggerAnticipation).toHaveBeenCalledWith('right', BATTLE_ANIM.ATTACK_ANTICIPATION_MS, false)
    expect(playerSprite.triggerAnimation).not.toHaveBeenCalledWith('attack', BATTLE_ANIM.LUNGE_MS, false, 'right')
    expect(opponentEffects.showDamageNumber).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(BATTLE_ANIM.ATTACK_ANTICIPATION_MS)
    })

    expect(playerSprite.triggerAnimation).toHaveBeenCalledWith('attack', BATTLE_ANIM.LUNGE_MS, false, 'right')
    expect(opponentEffects.showDamageNumber).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(BATTLE_ANIM.LUNGE_PEAK_MS)
    })

    expect(opponentSprite.triggerAnimation).toHaveBeenCalledWith('hurt', expect.any(Number), true)
    expect(opponentEffects.showDamageNumber).toHaveBeenCalledWith(18, true)
    expect(opponentEffects.showAttackImpact).toHaveBeenCalledWith(true)
    expect(opponentEffects.showCritBadge).toHaveBeenCalledTimes(1)
    expect(triggerArenaShake).toHaveBeenCalledWith(true)
  })

  it('uses focused attack impact and 3-hit hurt sequence for skill action', () => {
    vi.useFakeTimers()
    const playerSprite = spriteHandle()
    const opponentSprite = spriteHandle()
    const playerEffects = effectHandle()
    const opponentEffects = effectHandle()
    const { result } = renderHook(() =>
      useBattleLogReveal({
        playerSpriteRef: { current: playerSprite },
        opponentSpriteRef: { current: opponentSprite },
        playerEffectsRef: { current: playerEffects },
        opponentEffectsRef: { current: opponentEffects },
        triggerArenaShake: vi.fn(),
        triggerArenaFlash: vi.fn(),
        specialFlashRef: { current: { triggerFlash: vi.fn() } satisfies SpecialActionFlashHandle },
        playerMaxHp: 100,
        playerPipCap: 3,
        playerFocusGain: 1,
      }),
    )

    act(() => {
      result.current.revealEntries('run-1', [
        entry({
          id: 'skill-1',
          actor: 'player',
          action: 'skill',
          skillId: 'triple_hit',
          damage: 42,
          target: 'opponent',
          targetHpAfter: 20,
          crit: true,
        }),
      ], [])
      vi.advanceTimersByTime(0)
    })

    expect(playerEffects.showFocusSpend).toHaveBeenCalledWith(1)
    expect(playerSprite.triggerAnticipation).not.toHaveBeenCalled()
    expect(opponentEffects.showFocusedAttackImpact).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(BATTLE_ANIM.SKILL_PIP_SPEND_LEAD_MS)
    })

    expect(playerSprite.triggerAnticipation).toHaveBeenCalledWith('right', BATTLE_ANIM.ATTACK_ANTICIPATION_MS, false)
    expect(opponentEffects.showFocusedAttackImpact).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(BATTLE_ANIM.ATTACK_ANTICIPATION_MS + BATTLE_ANIM.LUNGE_PEAK_MS)
    })

    expect(opponentEffects.showFocusedAttackImpact).toHaveBeenCalledWith(
      true,
      3,
      BATTLE_ANIM.FOCUSED_HIT_SPACING_MS,
      'cut',
      expect.any(Object),
    )
    expect(opponentEffects.showAttackImpact).not.toHaveBeenCalled()
    expect(opponentSprite.triggerAnimation).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(BATTLE_ANIM.FOCUSED_HIT_SPACING_MS)
    })

    expect(opponentSprite.triggerAnimation).toHaveBeenCalledTimes(2)

    act(() => {
      vi.advanceTimersByTime(BATTLE_ANIM.FOCUSED_HIT_SPACING_MS)
    })

    expect(opponentSprite.triggerAnimation).toHaveBeenCalledTimes(3)
  })

  it('uses heavy anticipation before heavy skill contact', () => {
    vi.useFakeTimers()
    const playerSprite = spriteHandle()
    const opponentSprite = spriteHandle()
    const playerEffects = effectHandle()
    const opponentEffects = effectHandle()
    const { result } = renderHook(() =>
      useBattleLogReveal({
        playerSpriteRef: { current: playerSprite },
        opponentSpriteRef: { current: opponentSprite },
        playerEffectsRef: { current: playerEffects },
        opponentEffectsRef: { current: opponentEffects },
        triggerArenaShake: vi.fn(),
        triggerArenaFlash: vi.fn(),
        specialFlashRef: { current: { triggerFlash: vi.fn() } satisfies SpecialActionFlashHandle },
        playerMaxHp: 100,
        playerPipCap: 3,
        playerFocusGain: 1,
      }),
    )

    act(() => {
      result.current.revealEntries('run-1', [
        entry({
          id: 'power-strike-1',
          actor: 'player',
          action: 'skill',
          skillId: 'power_strike',
          damage: 58,
          target: 'opponent',
          targetHpAfter: 12,
        }),
      ], [])
      vi.advanceTimersByTime(0)
    })

    expect(playerEffects.showFocusSpend).toHaveBeenCalledWith(1)
    expect(playerSprite.triggerAnticipation).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(BATTLE_ANIM.SKILL_PIP_SPEND_LEAD_MS)
    })

    // V2: power_strike uses its own longer anticipation
    expect(playerSprite.triggerAnticipation).toHaveBeenCalledWith('right', BATTLE_ANIM.POWER_STRIKE_ANTICIPATION_MS, true)
    expect(playerSprite.triggerAnimation).not.toHaveBeenCalledWith('attack', BATTLE_ANIM.LUNGE_MS, false, 'right')
    expect(opponentEffects.showAttackImpact).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(BATTLE_ANIM.POWER_STRIKE_ANTICIPATION_MS)
    })

    expect(playerSprite.triggerAnimation).toHaveBeenCalledWith('attack', BATTLE_ANIM.LUNGE_MS, false, 'right')
    expect(opponentEffects.showAttackImpact).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(BATTLE_ANIM.LUNGE_PEAK_MS)
    })

    expect(opponentSprite.triggerAnimation).toHaveBeenCalledWith('hurt', BATTLE_ANIM.HURT_MS, false)
    expect(opponentEffects.showHeavyAttackImpact).toHaveBeenCalledWith(false, expect.any(Object))
    // V2: power_strike uses wide shockwave
    expect(opponentEffects.showGroundShockwave).toHaveBeenCalledWith(true)
  })

  it('spends all available pips before charge strike starts charging', () => {
    vi.useFakeTimers()
    const playerSprite = spriteHandle()
    const playerEffects = effectHandle()
    const { result } = renderHook(() =>
      useBattleLogReveal({
        playerSpriteRef: { current: playerSprite },
        opponentSpriteRef: { current: spriteHandle() },
        playerEffectsRef: { current: playerEffects },
        opponentEffectsRef: { current: effectHandle() },
        triggerArenaShake: vi.fn(),
        triggerArenaFlash: vi.fn(),
        specialFlashRef: { current: { triggerFlash: vi.fn() } satisfies SpecialActionFlashHandle },
        playerMaxHp: 100,
        playerPipCap: 3,
        playerFocusGain: 1,
      }),
    )
    const base = [
      entry({ id: 'focus-1', actor: 'player', action: 'focus' }),
      entry({ id: 'focus-2', actor: 'player', action: 'focus' }),
      entry({ id: 'focus-3', actor: 'player', action: 'focus' }),
    ]

    act(() => {
      result.current.revealEntries('run-1', [
        ...base,
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
      vi.advanceTimersByTime(0)
    })

    expect(playerEffects.showChargeStrikeSpend).toHaveBeenCalledWith(3)
    expect(playerSprite.triggerChargeGlow).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(BATTLE_ANIM.SKILL_PIP_SPEND_LEAD_MS)
    })

    expect(playerSprite.triggerChargeGlow).toHaveBeenCalledTimes(1)
  })

  it('uses five-hit overdrive timing for overdrive', () => {
    vi.useFakeTimers()
    const playerEffects = effectHandle()
    const opponentSprite = spriteHandle()
    const opponentEffects = effectHandle()
    const { result } = renderHook(() =>
      useBattleLogReveal({
        playerSpriteRef: { current: spriteHandle() },
        opponentSpriteRef: { current: opponentSprite },
        playerEffectsRef: { current: playerEffects },
        opponentEffectsRef: { current: opponentEffects },
        triggerArenaShake: vi.fn(),
        triggerArenaFlash: vi.fn(),
        specialFlashRef: { current: { triggerFlash: vi.fn() } satisfies SpecialActionFlashHandle },
        playerMaxHp: 100,
        playerPipCap: 3,
        playerFocusGain: 1,
      }),
    )

    act(() => {
      result.current.revealEntries('run-1', [
        entry({
          id: 'overdrive-1',
          actor: 'player',
          action: 'skill',
          skillId: 'overdrive',
          damage: 63,
          target: 'opponent',
          targetHpAfter: 11,
        }),
      ], [])
      vi.advanceTimersByTime(0)
    })

    expect(playerEffects.showFocusSpend).toHaveBeenCalledWith(3)

    act(() => {
      vi.advanceTimersByTime(
        BATTLE_ANIM.SKILL_PIP_SPEND_LEAD_MS
        + BATTLE_ANIM.ATTACK_ANTICIPATION_MS
        + BATTLE_ANIM.LUNGE_PEAK_MS,
      )
    })

    expect(opponentEffects.showFocusedAttackImpact).toHaveBeenCalledWith(
      false,
      5,
      BATTLE_ANIM.OVERDRIVE_HIT_SPACING_MS,
      'arc',
      expect.any(Object),
    )
    expect(opponentSprite.triggerAnimation).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(BATTLE_ANIM.OVERDRIVE_HIT_SPACING_MS * 4)
    })

    expect(opponentSprite.triggerAnimation).toHaveBeenCalledTimes(5)
  })

  it('waits until the final lethal hit finishes before triggering faint', () => {
    vi.useFakeTimers()
    const playerSprite = spriteHandle()
    const opponentSprite = spriteHandle()
    const playerEffects = effectHandle()
    const { result } = renderHook(() =>
      useBattleLogReveal({
        playerSpriteRef: { current: playerSprite },
        opponentSpriteRef: { current: opponentSprite },
        playerEffectsRef: { current: playerEffects },
        opponentEffectsRef: { current: effectHandle() },
        triggerArenaShake: vi.fn(),
        triggerArenaFlash: vi.fn(),
        specialFlashRef: { current: { triggerFlash: vi.fn() } satisfies SpecialActionFlashHandle },
        playerMaxHp: 100,
        playerPipCap: 3,
        playerFocusGain: 1,
      }),
    )

    act(() => {
      result.current.revealEntries('run-1', [
        entry({
          id: 'lethal-skill-1',
          actor: 'player',
          action: 'skill',
          skillId: 'triple_hit',
          damage: 42,
          target: 'opponent',
          targetHpAfter: 0,
        }),
      ], [])
      vi.advanceTimersByTime(0)
    })

    expect(playerEffects.showFocusSpend).toHaveBeenCalledWith(1)
    expect(playerSprite.triggerAnticipation).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(BATTLE_ANIM.SKILL_PIP_SPEND_LEAD_MS)
    })

    expect(playerSprite.triggerAnticipation).toHaveBeenCalledWith('right', BATTLE_ANIM.ATTACK_ANTICIPATION_MS, false)
    expect(playerSprite.triggerAnimation).not.toHaveBeenCalledWith('attack', BATTLE_ANIM.LUNGE_MS, false, 'right')

    act(() => {
      vi.advanceTimersByTime(BATTLE_ANIM.ATTACK_ANTICIPATION_MS + BATTLE_ANIM.LUNGE_PEAK_MS)
    })

    expect(playerSprite.triggerAnimation).toHaveBeenCalledWith('attack', BATTLE_ANIM.LUNGE_MS, false, 'right')
    expect(opponentSprite.triggerAnimation).toHaveBeenCalledWith('hurt', BATTLE_ANIM.HIT_IMPACT_MS, false)
    expect(opponentSprite.triggerAnimation).not.toHaveBeenCalledWith('faint', BATTLE_ANIM.FAINT_MS)

    act(() => {
      vi.advanceTimersByTime(
        (BATTLE_ANIM.FOCUSED_HIT_SPACING_MS * 2) + BATTLE_ANIM.HIT_IMPACT_MS,
      )
    })

    expect(opponentSprite.triggerAnimation).toHaveBeenLastCalledWith('faint', BATTLE_ANIM.FAINT_MS)
  })

  it('does not animate a malformed counter entry after the player already fainted', () => {
    vi.useFakeTimers()
    const playerSprite = spriteHandle()
    const opponentSprite = spriteHandle()
    const playerEffects = effectHandle()
    const opponentEffects = effectHandle()
    const { result } = renderHook(() =>
      useBattleLogReveal({
        playerSpriteRef: { current: playerSprite },
        opponentSpriteRef: { current: opponentSprite },
        playerEffectsRef: { current: playerEffects },
        opponentEffectsRef: { current: opponentEffects },
        triggerArenaShake: vi.fn(),
        triggerArenaFlash: vi.fn(),
        specialFlashRef: { current: { triggerFlash: vi.fn() } satisfies SpecialActionFlashHandle },
        playerMaxHp: 100,
        playerPipCap: 3,
        playerFocusGain: 1,
      }),
    )

    act(() => {
      result.current.revealEntries('run-1', [
        entry({
          id: 'counter-stance-1',
          actor: 'player',
          action: 'skill',
          skillId: 'counter_stance',
          target: 'player',
          targetHpAfter: 24,
        }),
        entry({
          id: 'lethal-attack-1',
          actor: 'opponent',
          action: 'attack',
          damage: 24,
          target: 'player',
          targetHpAfter: 0,
        }),
        entry({
          id: 'bad-counter-1',
          actor: 'player',
          action: 'counter',
          skillId: 'counter_stance',
          damage: 99,
          target: 'opponent',
          targetHpAfter: 0,
        }),
      ], [])
      vi.advanceTimersByTime(0)
    })

    act(() => {
      vi.advanceTimersByTime(BATTLE_ANIM.SKILL_PIP_SPEND_LEAD_MS + BATTLE_ANIM.SUPPORT_ANTICIPATION_MS)
    })
    expect(playerEffects.showPersistentGuard).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(
        BATTLE_ANIM.ENTRY_DELAY_ACTION_MS
        + BATTLE_ANIM.ATTACK_ANTICIPATION_MS
        + BATTLE_ANIM.LUNGE_PEAK_MS,
      )
    })
    expect(playerEffects.hidePersistentGuard).toHaveBeenCalled()
    expect(playerEffects.showDamageNumber).toHaveBeenCalledWith(24, false)

    act(() => {
      vi.advanceTimersByTime(BATTLE_ANIM.ENTRY_DELAY_ACTION_HIT_MS)
    })

    expect(opponentEffects.showDamageNumber).not.toHaveBeenCalledWith(99, false)
    expect(opponentEffects.showAttackImpact).not.toHaveBeenCalled()
    expect(opponentSprite.triggerAnimation).not.toHaveBeenCalledWith('hurt', expect.any(Number), false)
  })
})
