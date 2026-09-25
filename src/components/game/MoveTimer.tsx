import { useEffect, useEffectEvent, useState } from 'react'

interface MoveTimerProps {
  seconds: number
  onExpire: () => void
}

/**
 * Countdown for one turn. Mount it with `key` set to the turn, so every
 * turn starts a fresh clock.
 */
export function MoveTimer({ seconds, onExpire }: MoveTimerProps) {
  const [deadline] = useState(() => Date.now() + seconds * 1000)
  const [left, setLeft] = useState(seconds)
  const expire = useEffectEvent(onExpire)

  useEffect(() => {
    const tick = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      setLeft(remaining)
      if (remaining === 0) {
        window.clearInterval(tick)
        expire()
      }
    }, 250)
    return () => window.clearInterval(tick)
  }, [deadline])

  const urgent = left <= 5
  return (
    <span
      role="timer"
      aria-label={`${left} seconds left`}
      className={`rounded-full border px-2.5 py-0.5 font-display text-sm font-bold tabular-nums ${
        urgent ? 'animate-pulse border-rust-400 bg-rust-500/20 text-rust-300' : 'border-bronze-500/35 bg-soot-950/60 text-parchment-100'
      }`}
    >
      {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
    </span>
  )
}
