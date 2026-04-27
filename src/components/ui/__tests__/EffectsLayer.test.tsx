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

    render(<EffectsLayer ref={ref} hitImpactUrl="/impact.png" displaySize={160} />)

    act(() => {
      ref.current?.showDamageNumber(12, true)
      ref.current?.showCritBadge()
      ref.current?.showAttackImpact(true)
    })

    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('CRIT!')).toBeInTheDocument()
    expect(screen.getByTestId('battle-attack-impact')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(BATTLE_ANIM.HIT_IMPACT_MS)
    })

    expect(screen.queryByTestId('battle-attack-impact')).not.toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(BATTLE_ANIM.DAMAGE_NUMBER_MS)
    })

    expect(screen.queryByText('12')).not.toBeInTheDocument()
    expect(screen.queryByText('CRIT!')).not.toBeInTheDocument()
  })

  it('renders focused attack as three staggered impacts', () => {
    vi.useFakeTimers()
    const ref = createRef<EffectsLayerHandle>()

    render(<EffectsLayer ref={ref} hitImpactUrl="/impact.png" displaySize={160} />)

    act(() => {
      ref.current?.showFocusedAttackImpact(true)
    })

    expect(screen.getAllByTestId('battle-attack-impact')).toHaveLength(3)

    act(() => {
      vi.advanceTimersByTime(BATTLE_ANIM.HIT_IMPACT_MS + 180)
    })

    expect(screen.queryByTestId('battle-attack-impact')).not.toBeInTheDocument()
  })
})
