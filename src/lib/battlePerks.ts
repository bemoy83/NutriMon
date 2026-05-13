export const PERK_THRESHOLDS = {
  pipCapIncrease: 5,
  focusGainIncrease: 12,
} as const

export function getPipCap(level: number): number {
  return level >= PERK_THRESHOLDS.pipCapIncrease ? 4 : 3
}

export function getFocusGain(level: number): number {
  return level >= PERK_THRESHOLDS.focusGainIncrease ? 2 : 1
}
