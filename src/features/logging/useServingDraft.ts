import { useCallback, useMemo, useState } from 'react'
import type { FoodSource } from '@/types/domain'
import type { Item } from './types'
import {
  applyMassInputModeForLabel,
  buildConfirmPayloadItemEdit,
  computeLiveKcalItemEdit,
  initFoodSourceServingDraft,
  initItemServingDraft,
  isConfirmDisabledItemEdit,
  servingStepTargetFromItem,
} from './servingDraftModel'
import type { ServingStepTarget } from './ServingStep'

type MassDraftState = {
  pendingGrams: number
  pendingPortions: number
  massInputMode: 'grams' | 'portions'
  pendingMode: 'grams' | 'pieces'
}

const defaultMassState: MassDraftState = {
  pendingGrams: 100,
  pendingPortions: 1,
  massInputMode: 'grams',
  pendingMode: 'grams',
}

/**
 * Food browse → serving step (MealSheet). Reset via `reinitialize` when opening a food.
 */
export function useFoodSourceServingDraft() {
  const [state, setState] = useState<MassDraftState>(defaultMassState)

  const reinitialize = useCallback((food: FoodSource, existing?: Item) => {
    setState({ ...defaultMassState, ...initFoodSourceServingDraft(food, existing) })
  }, [])

  const setPendingGrams = useCallback((n: number | ((g: number) => number)) => {
    setState((s) => ({ ...s, pendingGrams: typeof n === 'function' ? n(s.pendingGrams) : n }))
  }, [])

  const setPendingPortions = useCallback((n: number | ((g: number) => number)) => {
    setState((s) => ({ ...s, pendingPortions: typeof n === 'function' ? n(s.pendingPortions) : n }))
  }, [])

  const setMassInputMode = useCallback((m: 'grams' | 'portions') => {
    setState((s) => ({ ...s, massInputMode: m }))
  }, [])

  const setPendingMode = useCallback((m: 'grams' | 'pieces') => {
    setState((s) => ({ ...s, pendingMode: m }))
  }, [])

  return {
    ...state,
    setPendingGrams,
    setPendingPortions,
    setMassInputMode,
    setPendingMode,
    reinitialize,
  }
}

/**
 * `ServingEditSheet`: draft state and derived kcal / confirm for an `Item` row.
 */
export function useItemServingDraftState(item: Item) {
  const [state, setState] = useState<MassDraftState>(() => {
    const next = initItemServingDraft(item)
    return { ...defaultMassState, ...next }
  })

  const setPendingGrams = useCallback((n: number | ((g: number) => number)) => {
    setState((s) => ({ ...s, pendingGrams: typeof n === 'function' ? n(s.pendingGrams) : n }))
  }, [])

  const setPendingPortions = useCallback((n: number | ((g: number) => number)) => {
    setState((s) => ({ ...s, pendingPortions: typeof n === 'function' ? n(s.pendingPortions) : n }))
  }, [])

  const setMassInputMode = useCallback((m: 'grams' | 'portions') => {
    setState((s) => ({ ...s, massInputMode: m }))
  }, [])

  const setPendingMode = useCallback((m: 'grams' | 'pieces') => {
    setState((s) => ({ ...s, pendingMode: m }))
  }, [])

  const target: ServingStepTarget = useMemo(() => servingStepTargetFromItem(item), [item])

  const liveKcal = useMemo(
    () => computeLiveKcalItemEdit(item, state),
    [item, state],
  )

  const confirmDisabled = useMemo(
    () => isConfirmDisabledItemEdit(item, target, state),
    [item, target, state],
  )

  const confirmPayload = useCallback(() => buildConfirmPayloadItemEdit(item, state), [item, state])

  const onMassInputModeChange = useCallback(
    (mode: 'grams' | 'portions') => {
      setState((s) => {
        const { pendingGrams, pendingPortions } = applyMassInputModeForLabel(
          target.labelPortionGrams,
          mode,
          s.pendingGrams,
          s.pendingPortions,
        )
        return { ...s, massInputMode: mode, pendingGrams, pendingPortions }
      })
    },
    [target.labelPortionGrams],
  )

  return {
    ...state,
    setPendingGrams,
    setPendingPortions,
    setMassInputMode,
    setPendingMode,
    target,
    liveKcal,
    confirmDisabled,
    confirmPayload,
    onMassInputModeChange,
  }
}
