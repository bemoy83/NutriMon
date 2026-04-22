import { useLayoutEffect, useState } from 'react'

const ENTER_DELTA = 36
const EXIT_DELTA = 16

function resolveScrollRoot(anchor: HTMLElement): HTMLElement | null {
  const main = anchor.closest('main')
  if (main instanceof HTMLElement) return main
  return document.scrollingElement instanceof HTMLElement ? document.scrollingElement : null
}

interface DailyLogHeaderCompactArgs {
  scrollAnchor: HTMLElement | null
  dateSticky: HTMLElement | null
  fullHeader: HTMLElement | null
  resetKey: string
}

/**
 * Toggle compact mode when the full header card reaches the sticky date row.
 * This keeps the handoff tied to the actual geometry on screen rather than raw scrollTop.
 */
export function useDailyLogHeaderCompact({
  scrollAnchor,
  dateSticky,
  fullHeader,
  resetKey,
}: DailyLogHeaderCompactArgs): boolean {
  const [compact, setCompact] = useState(false)
  const scrollRoot = scrollAnchor ? resolveScrollRoot(scrollAnchor) : null

  useLayoutEffect(() => {
    if (!scrollAnchor || !scrollRoot || !dateSticky || !fullHeader) {
      return
    }

    let frame = 0
    let baselineDelta: number | null = null

    const sync = () => {
      const stickyBottom = dateSticky.getBoundingClientRect().bottom
      const fullHeaderTop = fullHeader.getBoundingClientRect().top
      const delta = fullHeaderTop - stickyBottom
      if (baselineDelta == null || (scrollRoot.scrollTop <= 1 && !compact)) {
        baselineDelta = delta
      }

      const compactAt = baselineDelta - ENTER_DELTA
      const expandAt = baselineDelta - EXIT_DELTA

      setCompact((prev) => {
        if (!prev && delta <= compactAt) return true
        if (prev && delta >= expandAt) return false
        return prev
      })
    }

    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(sync)
    }

    sync()
    scrollRoot.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })

    return () => {
      cancelAnimationFrame(frame)
      scrollRoot.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
    // `compact` is read for baseline re-seeding; listing it would re-bind listeners every toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional stale read for scroll geometry
  }, [dateSticky, fullHeader, resetKey, scrollAnchor, scrollRoot])

  return scrollRoot && dateSticky && fullHeader ? compact : false
}
