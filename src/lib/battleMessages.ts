import type { BattleLogEntry } from '@/types/domain'

export function getBattleDialogue(
  entry: BattleLogEntry,
  companionName: string,
  opponentName: string,
  playerMaxHp: number,
  opponentMaxHp: number,
): string {
  const { actor, action, phase, damage, crit, defended, target, targetHpAfter, consumedMomentumBoost, firstActor } = entry

  const targetMaxHp = target === 'player' ? playerMaxHp : opponentMaxHp
  const lowHp = targetHpAfter !== null && targetMaxHp > 0 && targetHpAfter / targetMaxHp < 0.15
  const lowHpTag = lowHp
    ? target === 'player'
      ? ` ${companionName} is barely holding on!`
      : ` ${opponentName} is almost done!`
    : ''

  if (action === 'initiative') {
    return firstActor === 'player'
      ? `${companionName} is quick — moving first!`
      : `${opponentName} lunges in before ${companionName} can act!`
  }

  if (action === 'defend') {
    return actor === 'player'
      ? `${companionName} braces for the hit.`
      : `${opponentName} hunkers down.`
  }

  if (action === 'focus') {
    return actor === 'player'
      ? `${companionName} gathers focus...`
      : `${opponentName} seems to be building up power...`
  }

  if (action === 'attack') {
    if (actor === 'player') {
      if (crit && consumedMomentumBoost) return `${companionName}'s charged strike hits critically — ${damage} damage!${lowHpTag}`
      if (crit)                          return `Critical! ${companionName} finds the weak spot — ${damage} damage!${lowHpTag}`
      if (consumedMomentumBoost)         return `${companionName} channels focus into a powerful strike — ${damage} damage!${lowHpTag}`
      if (defended)                      return `${companionName} pushes through ${opponentName}'s guard — ${damage} damage.${lowHpTag}`
      return `${companionName} lands a solid hit — ${damage} damage!${lowHpTag}`
    } else {
      if (crit)    return `${opponentName} lands a savage blow — ${damage} damage!${lowHpTag}`
      if (defended) return `${opponentName} hits ${companionName}'s guard — only ${damage} gets through.${lowHpTag}`
      return `${opponentName} strikes for ${damage} damage!${lowHpTag}`
    }
  }

  if (action === 'skill') {
    const { skillId } = entry
    if (skillId === 'counter_stance') return `${companionName} takes Counter Stance — ready to deflect and retaliate!`
    if (skillId === 'charge_strike' || skillId === 'overdrive') return entry.message
    if (crit && defended) return `${companionName}'s combo cracks through the defense — ${damage} damage!${lowHpTag}`
    if (crit)             return `${companionName}'s rapid combo lands a critical hit — ${damage} damage!${lowHpTag}`
    if (defended)         return `${companionName}'s flurry is partly blocked — ${damage} damage.${lowHpTag}`
    return `${companionName} unleashes a rapid combo — ${damage} damage!${lowHpTag}`
  }

  if (action === 'counter') return entry.message

  if (action === 'special') {
    if (crit && defended) return `${opponentName}'s relentless assault cracks through — ${damage} damage!${lowHpTag}`
    if (crit)             return `${opponentName}'s barrage finds its mark — ${damage} damage!${lowHpTag}`
    if (defended)         return `${opponentName}'s assault is partly blunted — ${damage} damage.${lowHpTag}`
    return `${opponentName} strikes in a relentless flurry — ${damage} damage!${lowHpTag}`
  }

  if (phase === 'result') return entry.message

  return entry.message
}
