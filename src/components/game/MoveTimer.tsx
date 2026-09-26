import { useEffect, useEffectEvent, useRef, useState } from 'react'

interface MoveTimerProps {
  seconds: number
  /** Stops the clock (a dialog, the pass screen or the era banner is open). */
  paused: boolean
  onExpire: () => void
}

const R = 15
const CIRCUMFERENCE = 2 * Math.PI * R

/**
 * Countdown for one turn, drawn as a ring that empties. Mount it with `key`
 * set to the turn, so every turn starts a fresh clock. While paused, the
 * time left is kept and the clock resumes from there.
 */
export function MoveTimer({ seconds, paused, onExpire }: MoveTimerProps) {
  const [left, setLeft] = useState(seconds * 1000)
  const leftRef = useRef(seconds * 1000)
  const expire = useEffectEvent(onExpire)

  useEffect(() => {
    if (paused || leftRef.current <= 0) return
    let last = performance.now()
    const tick = window.setInterval(() => {
      const now = performance.now()
      leftRef.current = Math.max(0, leftRef.current - (now - last))
      last = now
      setLeft(leftRef.current)
      if (leftRef.current === 0) {
        window.clearInterval(tick)
        expire()
      }
    }, 200)
    return () => window.clearInterval(tick)
  }, [paused])

  const secs = Math.ceil(left / 1000)
  const urgent = secs <= 5
  const share = left / (seconds * 1000)
  return (
    <span
      role="timer"
      aria-label={`${secs} seconds left in this turn${paused ? ', paused' : ''}`}
      className={`relative grid size-11 shrink-0 place-items-center ${urgent && !paused ? 'animate-pulse' : ''}`}
      title={paused ? 'Timer paused' : 'Time left this turn'}
    >
      <svg viewBox="0 0 36 36" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
        <circle cx={18} cy={18} r={R} fill="none" strokeWidth={3.5} className="stroke-soot-700" />
        <circle
          cx={18}
          cy={18}
          r={R}
          fill="none"
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - share)}
          className={urgent ? 'stroke-rust-400' : paused ? 'stroke-parchment-500' : 'stroke-brass-300'}
        />
      </svg>
      <span className={`font-display text-sm font-bold tabular-nums ${urgent ? 'text-rust-300' : 'text-parchment-50'}`}>
        {paused ? '❚❚' : secs}
      </span>
    </span>
  )
}
