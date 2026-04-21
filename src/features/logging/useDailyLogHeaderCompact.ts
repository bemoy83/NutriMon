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

function resolveScrollRoot(anchor: HTMLElement): HTMLElement | null {
  const main = anchor.closest('main')
  if (main instanceof HTMLElement) return main
  return getScrollParent(anchor)
}

function readScrollY(
  anchor: HTMLElement,
  scrollRoot: HTMLElement | null,
  e?: Event,
): number {
  let y = scrollRoot?.scrollTop ?? 0
  if (e?.target instanceof HTMLElement) {
    const t = e.target
    const rel =
      scrollRoot != null
        ? t === scrollRoot || (scrollRoot.contains(t) && anchor.contains(t))
        : anchor.contains(t) || t.contains(anchor)
    if (rel) y = Math.max(y, t.scrollTop)
  }
  return y
}

/**
 * Collapse the daily log header after the user scrolls the log (mobile-first layout).
 *
 * Listens in the **capture** phase on `window` as well as on `main`, because `scroll`
 * does not bubble — a listener only on `main` can miss updates in some environments.
 * Merges `scrollTop` from `main` and from any nested scroll region inside the log page.
 */
export function useDailyLogHeaderCompact(
  scrollAnchorRef: RefObject<HTMLElement | null>,
  resetKey: string,
): boolean {
  const [compact, setCompact] = useState(false)

  useLayoutEffect(() => {
    const anchor = scrollAnchorRef.current
    if (!anchor) return

    const scrollRoot = resolveScrollRoot(anchor)

    let isCompact = false

    const apply = (e?: Event) => {
      const y = readScrollY(anchor, scrollRoot, e)
      if (!isCompact && y >= SHRINK_AT) {
        isCompact = true
        setCompact(true)
      } else if (isCompact && y <= EXPAND_AT) {
        isCompact = false
        setCompact(false)
      }
    }

    const y0 = readScrollY(anchor, scrollRoot)
    isCompact = y0 >= SHRINK_AT
    setCompact(isCompact)

    const onScroll = (e: Event) => apply(e)

    scrollRoot?.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('scroll', onScroll, { capture: true, passive: true })

    return () => {
      scrollRoot?.removeEventListener('scroll', onScroll)
      window.removeEventListener('scroll', onScroll, { capture: true } as AddEventListenerOptions)
    }
  }, [resetKey, scrollAnchorRef])

  return compact
}
