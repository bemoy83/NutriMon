import { describe, expect, it } from 'vitest'
import {
  doesBattleSkillSpendAllPips,
  getBattleSkill,
  getBattleSkillPipCost,
} from '@/lib/battleSkills'

describe('battleSkills', () => {
  it('returns skill metadata and pip costs', () => {
    expect(getBattleSkill('regen')).toEqual(expect.objectContaining({
      id: 'regen',
      pipCost: 2,
      kind: 'heal',
    }))
    expect(getBattleSkillPipCost('overdrive')).toBe(3)
  })

  it('identifies all-pip skills and falls back for unknown skill ids', () => {
    expect(doesBattleSkillSpendAllPips('charge_strike')).toBe(true)
    expect(doesBattleSkillSpendAllPips('regen')).toBe(false)
    expect(getBattleSkill('missing')).toBeNull()
    expect(getBattleSkillPipCost('missing')).toBe(1)
  })
})
