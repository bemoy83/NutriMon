export const PERK_THRESHOLDS = {
  pipCapIncrease4: 10,
  pipCapIncrease5: 20,
  focusGainIncrease: 12,
} as const

export function getPipCap(level: number): number {
  if (level >= PERK_THRESHOLDS.pipCapIncrease5) return 5
  if (level >= PERK_THRESHOLDS.pipCapIncrease4) return 4
  return 3
}

export function getFocusGain(level: number): number {
  return level >= PERK_THRESHOLDS.focusGainIncrease ? 2 : 1
}
