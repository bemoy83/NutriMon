import { useLayoutEffect, useState } from 'react'

const SHRINK_AT = 48
const EXPAND_AT = 20

function resolveScrollRoot(anchor: HTMLElement): HTMLElement | null {
  const main = anchor.closest('main')
  if (main instanceof HTMLElement) return main
  return document.scrollingElement instanceof HTMLElement ? document.scrollingElement : null
}

/**
 * Collapse the daily log header after the page has meaningfully scrolled.
 */
export function useDailyLogHeaderCompact(
  scrollAnchor: HTMLElement | null,
  resetKey: string,
): boolean {
  const [compact, setCompact] = useState(false)
  const scrollRoot = scrollAnchor ? resolveScrollRoot(scrollAnchor) : null

  useLayoutEffect(() => {
    if (!scrollAnchor || !scrollRoot) {
      return
    }

    let frame = 0

    const sync = () => {
      const y = scrollRoot.scrollTop
      setCompact((prev) => {
        if (!prev && y >= SHRINK_AT) return true
        if (prev && y <= EXPAND_AT) return false
        return prev
      })
    }

    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(sync)
    }

    sync()
    scrollRoot.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      cancelAnimationFrame(frame)
      scrollRoot.removeEventListener('scroll', onScroll)
    }
  }, [resetKey, scrollAnchor, scrollRoot])

  return scrollRoot ? compact : false
}
