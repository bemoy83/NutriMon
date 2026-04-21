import { useLayoutEffect, useState, type RefObject } from 'react'

const SHRINK_AT = 48
const EXPAND_AT = 20
const NARROW_MAX_PX = 767

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

/** Prefer innerWidth: embedded / in-editor browsers often mis-implement matchMedia. */
function readNarrowViewport(): boolean {
  if (typeof window === 'undefined') return false
  return window.innerWidth <= NARROW_MAX_PX
}

function useNarrowLogViewport(): boolean {
  const [narrow, setNarrow] = useState(readNarrowViewport)

  useLayoutEffect(() => {
    const sync = () => setNarrow(readNarrowViewport())
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [])

  return narrow
}

/**
 * Pick the element that actually scrolls: flex `main` first, else document scrolling element.
 */
function resolveScrollRoot(anchor: HTMLElement): HTMLElement | null {
  const walked = getScrollParent(anchor)
  if (walked && walked.scrollHeight > walked.clientHeight) {
    return walked
  }
  const se = document.scrollingElement
  if (se instanceof HTMLElement && se.scrollHeight > se.clientHeight) {
    return se
  }
  return walked
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

    const scrollRoot = resolveScrollRoot(anchor)
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
