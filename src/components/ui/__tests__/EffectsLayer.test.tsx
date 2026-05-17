import { act, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import EffectsLayer, { type EffectsLayerHandle } from '../EffectsLayer'
import { BATTLE_ANIM } from '@/lib/battleAnimationConfig'

describe('EffectsLayer', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders and clears defend guard effects', () => {
    vi.useFakeTimers()
    const ref = createRef<EffectsLayerHandle>()

    render(<EffectsLayer ref={ref} displaySize={160} />)

    act(() => {
      ref.current?.showDefendGuard()
    })

    expect(screen.getByTestId('battle-defend-guard')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(BATTLE_ANIM.DEFEND_GUARD_MS)
    })

    expect(screen.queryByTestId('battle-defend-guard')).not.toBeInTheDocument()
  })

  it('renders and clears guard impact effects', () => {
    vi.useFakeTimers()
    const ref = createRef<EffectsLayerHandle>()

    render(<EffectsLayer ref={ref} displaySize={160} />)

    act(() => {
      ref.current?.showGuardImpact('heavy')
    })

    expect(screen.getByTestId('battle-guard-impact')).toHaveAttribute('data-intensity', 'heavy')

    act(() => {
      vi.advanceTimersByTime(BATTLE_ANIM.GUARD_IMPACT_MS)
    })

    expect(screen.queryByTestId('battle-guard-impact')).not.toBeInTheDocument()
  })

  it('renders and clears focus charge effects', () => {
    vi.useFakeTimers()
    const ref = createRef<EffectsLayerHandle>()

    render(<EffectsLayer ref={ref} displaySize={160} />)

    act(() => {
      ref.current?.showFocusCharge()
    })

    expect(screen.getByTestId('battle-focus-charge')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(BATTLE_ANIM.FOCUS_CHARGE_MS)
    })

    expect(screen.queryByTestId('battle-focus-charge')).not.toBeInTheDocument()
  })

  it('keeps existing damage, crit, and attack impact effects transient', () => {
    vi.useFakeTimers()
    const ref = createRef<EffectsLayerHandle>()

    render(<EffectsLayer ref={ref} displaySize={160} />)

    act(() => {
      ref.current?.showDamageNumber(12, true)
      ref.current?.showAttackImpact(true)
    })

    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByTestId('battle-attack-impact')).toBeInTheDocument()
    expect(screen.getByTestId('battle-hit-spark')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(BATTLE_ANIM.HIT_IMPACT_MS)
    })

    expect(screen.queryByTestId('battle-attack-impact')).not.toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(BATTLE_ANIM.DAMAGE_NUMBER_MS)
    })

    expect(screen.queryByText('12')).not.toBeInTheDocument()
  })

  it('renders focused attack as three staggered impacts', async () => {
    const ref = createRef<EffectsLayerHandle>()

    render(<EffectsLayer ref={ref} displaySize={160} />)

    act(() => {
      ref.current?.showFocusedAttackImpact(true)
    })

    expect(screen.getAllByTestId('battle-attack-impact')).toHaveLength(1)

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, BATTLE_ANIM.FOCUSED_HIT_SPACING_MS + 10))
    })

    expect(screen.getAllByTestId('battle-attack-impact')).toHaveLength(2)

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, BATTLE_ANIM.FOCUSED_HIT_SPACING_MS))
    })

    expect(screen.getAllByTestId('battle-attack-impact')).toHaveLength(2)

    await act(async () => {
      await new Promise((resolve) =>
        setTimeout(resolve, BATTLE_ANIM.HIT_IMPACT_MS + 10),
      )
    })

    expect(screen.queryByTestId('battle-attack-impact')).not.toBeInTheDocument()
  })

  it('renders overdrive as five faster staggered impacts', async () => {
    const ref = createRef<EffectsLayerHandle>()

    render(<EffectsLayer ref={ref} displaySize={160} />)

    act(() => {
      ref.current?.showFocusedAttackImpact(false, 5, BATTLE_ANIM.OVERDRIVE_HIT_SPACING_MS)
    })

    expect(screen.getAllByTestId('battle-attack-impact')).toHaveLength(1)

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, BATTLE_ANIM.OVERDRIVE_HIT_SPACING_MS * 2 + 10))
    })

    expect(screen.getAllByTestId('battle-attack-impact')).toHaveLength(3)

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, BATTLE_ANIM.HIT_IMPACT_MS + 10))
    })

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, BATTLE_ANIM.OVERDRIVE_HIT_SPACING_MS * 3))
    })

    expect(screen.queryByTestId('battle-attack-impact')).not.toBeInTheDocument()
  })

  it('marks only the final focused attack impact as emphasized', () => {
    vi.useFakeTimers()
    const ref = createRef<EffectsLayerHandle>()

    render(<EffectsLayer ref={ref} displaySize={160} />)

    act(() => {
      ref.current?.showFocusedAttackImpact(
        false,
        3,
        BATTLE_ANIM.FOCUSED_HIT_SPACING_MS,
        'arc',
        undefined,
        { emphasizeFinalHit: true },
      )
    })

    expect(screen.getByTestId('battle-attack-impact')).not.toHaveAttribute('data-emphasis')

    act(() => {
      vi.advanceTimersByTime(BATTLE_ANIM.FOCUSED_HIT_SPACING_MS * 2)
    })

    const impacts = screen.getAllByTestId('battle-attack-impact')
    expect(impacts).toHaveLength(2)
    expect(impacts.filter((impact) => impact.getAttribute('data-emphasis') === 'true')).toHaveLength(1)
  })

  it('renders heavy impact as emphasis burst', () => {
    vi.useFakeTimers()
    const ref = createRef<EffectsLayerHandle>()

    render(<EffectsLayer ref={ref} displaySize={160} />)

    act(() => {
      ref.current?.showHeavyAttackImpact(true)
    })

    expect(screen.getByTestId('battle-attack-impact')).toBeInTheDocument()
    expect(screen.getByTestId('battle-attack-impact')).toHaveAttribute('data-emphasis', 'true')
    expect(screen.getByTestId('battle-hit-spark')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(BATTLE_ANIM.HIT_IMPACT_MS + BATTLE_ANIM.HIT_STOP_MS)
    })

    expect(screen.queryByTestId('battle-attack-impact')).not.toBeInTheDocument()
  })
})
