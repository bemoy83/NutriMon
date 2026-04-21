import { useLayoutEffect, useState, type RefObject } from 'react'

const SHRINK_AT = 48
const EXPAND_AT = 20

function getScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node: HTMLElement | null = el
  while (node) {
    const { overflowY } = getComputedStyle(node)
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
      return node
    }
    node = node.parentElement
  }
  return null
}

function readNarrowViewport(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  try {
    return window.matchMedia('(max-width: 767px)').matches
  } catch {
    return false
  }
}

function useNarrowLogViewport(): boolean {
  const [narrow, setNarrow] = useState(readNarrowViewport)

  useLayoutEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      setNarrow(false)
      return
    }
    const mq = window.matchMedia('(max-width: 767px)')
    const onChange = () => setNarrow(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return narrow
}

/**
 * On narrow viewports, collapse the daily log header after the app shell main scrolls down (hysteresis).
 */
export function useDailyLogHeaderCompact(
  scrollAnchorRef: RefObject<HTMLElement | null>,
  resetKey: string,
): boolean {
  const narrow = useNarrowLogViewport()
  const [scrollCompact, setScrollCompact] = useState(false)

  useLayoutEffect(() => {
    if (!narrow) {
      setScrollCompact(false)
      return
    }

    const anchor = scrollAnchorRef.current
    if (!anchor) return

    const scrollRoot = getScrollParent(anchor)
    if (!scrollRoot) return

    const y0 = scrollRoot.scrollTop
    let isCompact = y0 >= SHRINK_AT
    setScrollCompact(isCompact)

    const update = () => {
      const y = scrollRoot.scrollTop
      if (!isCompact && y >= SHRINK_AT) {
        isCompact = true
        setScrollCompact(true)
      } else if (isCompact && y <= EXPAND_AT) {
        isCompact = false
        setScrollCompact(false)
      }
    }

    scrollRoot.addEventListener('scroll', update, { passive: true })
    return () => {
      scrollRoot.removeEventListener('scroll', update)
    }
  }, [narrow, resetKey, scrollAnchorRef])

  return narrow && scrollCompact
}
