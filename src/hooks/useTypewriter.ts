import { useEffect, useRef, useState } from 'react'

export function useTypewriter(text: string | null, charDelayMs = 22) {
  const [displayed, setDisplayed] = useState(text ?? '')
  const [isDone, setIsDone] = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    const target = text ?? ''

    if (!target) {
      setDisplayed('')
      setIsDone(true)
      return
    }

    setDisplayed('')
    setIsDone(false)

    let i = 0
    function tick() {
      i++
      setDisplayed(target.slice(0, i))
      if (i < target.length) {
        timerRef.current = setTimeout(tick, charDelayMs)
      } else {
        setIsDone(true)
      }
    }
    timerRef.current = setTimeout(tick, charDelayMs)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [text, charDelayMs])

  return { displayed, isDone }
}
