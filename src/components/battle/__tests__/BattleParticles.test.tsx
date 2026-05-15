import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BattleParticles } from '../BattleParticles'

const VERDANTROOT_ARENA_ID = '37543fca-9f22-41c7-83b5-2ded30d7b063'

describe('BattleParticles', () => {
  it('renders separate back and front particle depth layers', () => {
    render(<BattleParticles arenaId={VERDANTROOT_ARENA_ID} />)

    expect(screen.getByTestId('battle-particles-back')).toBeInTheDocument()
    expect(screen.getByTestId('battle-particles-front')).toBeInTheDocument()
  })

  it('keeps foreground particles out of the fixed HUD and command zones', () => {
    render(<BattleParticles arenaId={VERDANTROOT_ARENA_ID} />)

    const frontLayer = screen.getByTestId('battle-particles-front')

    expect(frontLayer).toHaveStyle({ top: '5rem', bottom: '10rem' })
  })

  it('dims both particle layers while combat animation is active', () => {
    render(<BattleParticles arenaId={VERDANTROOT_ARENA_ID} combatActive />)

    expect(screen.getByTestId('battle-particles-back')).toHaveStyle({ opacity: '0.42' })
    expect(screen.getByTestId('battle-particles-front')).toHaveStyle({ opacity: '0.22' })
  })
})
