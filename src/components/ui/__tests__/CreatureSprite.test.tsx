import { act, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BATTLE_ANIM } from '@/lib/battleAnimationConfig'
import type { SpriteDescriptor } from '@/lib/sprites'
import CreatureSprite, { type CreatureSpriteHandle } from '../CreatureSprite'

const descriptor: SpriteDescriptor = {
  url: '/sprites/test-creature.png',
  nativeWidth: 256,
  nativeHeight: 256,
  facing: 'right',
  pixelArt: true,
}

describe('CreatureSprite', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('queues overlapping hurt flashes for rapid multi-hit attacks', () => {
    vi.useFakeTimers()
    const ref = createRef<CreatureSpriteHandle>()

    render(<CreatureSprite ref={ref} descriptor={descriptor} displaySize={128} />)

    act(() => {
      ref.current?.triggerAnimation('hurt', BATTLE_ANIM.HIT_IMPACT_MS, false, 'right')
    })

    expect(screen.getAllByTestId('battle-hit-flash')).toHaveLength(1)

    act(() => {
      vi.advanceTimersByTime(BATTLE_ANIM.FOCUSED_HIT_SPACING_MS)
      ref.current?.triggerAnimation('hurt', BATTLE_ANIM.HIT_IMPACT_MS, false, 'right')
    })

    expect(screen.getAllByTestId('battle-hit-flash')).toHaveLength(2)

    act(() => {
      vi.advanceTimersByTime(BATTLE_ANIM.HIT_IMPACT_MS - BATTLE_ANIM.FOCUSED_HIT_SPACING_MS)
    })

    expect(screen.getAllByTestId('battle-hit-flash')).toHaveLength(1)

    act(() => {
      vi.advanceTimersByTime(BATTLE_ANIM.FOCUSED_HIT_SPACING_MS)
    })

    expect(screen.queryByTestId('battle-hit-flash')).not.toBeInTheDocument()
  })
})
