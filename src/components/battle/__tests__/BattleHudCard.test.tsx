import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BattleHudFocusPips, BattleHudHpBar } from '../BattleHudCard'

describe('BattleHudCard feedback', () => {
  it('shows a transient HP damage delta when HP drops', () => {
    const { rerender } = render(<BattleHudHpBar current={80} max={100} />)

    expect(screen.queryByText('-20')).not.toBeInTheDocument()

    rerender(<BattleHudHpBar current={60} max={100} />)

    expect(screen.getByText('-20')).toBeInTheDocument()
  })

  it('shows a transient HP heal delta when HP rises', () => {
    const { rerender } = render(<BattleHudHpBar current={40} max={100} />)

    rerender(<BattleHudHpBar current={55} max={100} />)

    expect(screen.getByText('+15')).toBeInTheDocument()
  })

  it('shows FP gain and spend deltas', () => {
    const { rerender } = render(<BattleHudFocusPips count={1} pipCap={4} />)

    rerender(<BattleHudFocusPips count={2} pipCap={4} />)

    expect(screen.getByText('+1 FP')).toBeInTheDocument()

    rerender(<BattleHudFocusPips count={0} pipCap={4} />)

    expect(screen.getByText('-2 FP')).toBeInTheDocument()
  })
})
