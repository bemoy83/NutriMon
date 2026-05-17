import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BattleHudFocusPips, BattleHudHpBar } from '../BattleHudCard'

describe('BattleHudCard feedback', () => {
  it('shows FP gain and spend deltas', () => {
    const { rerender } = render(<BattleHudFocusPips count={1} pipCap={4} />)

    rerender(<BattleHudFocusPips count={2} pipCap={4} />)

    expect(screen.getByText('+1 FP')).toBeInTheDocument()

    rerender(<BattleHudFocusPips count={0} pipCap={4} />)

    expect(screen.getByText('-2 FP')).toBeInTheDocument()
  })
})
