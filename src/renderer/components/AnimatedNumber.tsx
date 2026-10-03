import * as React from 'react'
import { useEffect, useRef, useState } from 'react'
import { animate, useReducedMotion } from 'framer-motion'
import { DURATION, EASE_OUT } from '../lib/motion'

interface AnimatedNumberProps {
  value: number
  /** Formats the in-flight and final value (e.g. formatCurrency). Defaults to rounded integers. */
  format?: (n: number) => string
  className?: string
  'data-testid'?: string
}

/**
 * Counts from the previous value to the new one (report cards). With reduced motion,
 * or for tests reading the text, the final value is always what ends up in the DOM.
 */
export function AnimatedNumber({
  value,
  format = (n) => String(Math.round(n)),
  className,
  'data-testid': testId
}: AnimatedNumberProps): React.JSX.Element {
  const reduce = useReducedMotion()
  const [display, setDisplay] = useState(value)
  const from = useRef(value)

  useEffect(() => {
    if (reduce) {
      from.current = value
      setDisplay(value)
      return
    }
    const controls = animate(from.current, value, {
      duration: DURATION.slow * 2,
      ease: EASE_OUT,
      onUpdate: (n) => setDisplay(n),
      onComplete: () => {
        from.current = value
        setDisplay(value)
      }
    })
    return () => {
      from.current = value
      controls.stop()
    }
  }, [value, reduce])

  return (
    <span className={className} data-testid={testId}>
      {format(display)}
    </span>
  )
}
