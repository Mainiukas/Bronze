import { useEffect, useRef } from 'react'
import type { GameState, LogKind } from '../../game/types'
import { PLAYER_STYLE } from './glyphs'

/** Small line icons for each kind of log entry (16 × 16, drawn in currentColor). */
const ICONS: Record<LogKind, string> = {
  // Factory with a chimney
  build: 'M2 14V7l4 2.5V7l4 2.5V3h3v11z',
  // Two dots on a rail: the link symbol
  link: 'M1.5 8a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M10.5 8a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M5.5 7h5v2h-5z',
  // Crate with an arrow
  ship: 'M2 6h8v8H2zM11 9h2V6l3 4-3 4v-3h-2z',
  // Pound sign
  funds: 'M10.5 4.2A2.8 2.8 0 0 0 5.7 6.2V8H4v1.6h1.7v1.9L4 13.5h8.5v-1.6H6.8l.5-1.2V9.6h2.6V8H7.3V6.2a1.2 1.2 0 0 1 2.1-.8z',
  // Hourglass
  turn: 'M4 2h8v1.5c0 2-1.6 3.4-3 4.5 1.4 1.1 3 2.5 3 4.5V14H4v-1.5c0-2 1.6-3.4 3-4.5-1.4-1.1-3-2.5-3-4.5z',
  // Cog
  round: 'M7 1h2l.4 2 1.6.7 1.7-1.2 1.4 1.4-1.2 1.7.7 1.6 2 .4v2l-2 .4-.7 1.6 1.2 1.7-1.4 1.4-1.7-1.2-1.6.7-.4 2H7l-.4-2-1.6-.7-1.7 1.2-1.4-1.4 1.2-1.7L2.4 9.4.4 9V7l2-.4.7-1.6-1.2-1.7 1.4-1.4 1.7 1.2 1.6-.7zM8 5.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5',
  // Locomotive
  era: 'M1 11V6h6V4h2v2h3l3 3v2zM2 12.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0M9 12.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0',
  // Circular arrow
  reset: 'M8 2a6 6 0 1 0 6 6h-2a4 4 0 1 1-4-4v2l3.5-3L8 0z',
  // Star
  end: 'M8 1l2 4.6 5 .5-3.8 3.3 1.1 4.9L8 11.8 3.7 14.3l1.1-4.9L1 6.1l5-.5z',
}

/** The match log, oldest first, scrolled to the newest entry as it grows. Keeps the last 80 entries. */
export function GameLog({ game, colorBlind }: { game: GameState; colorBlind: boolean }) {
  const listRef = useRef<HTMLOListElement>(null)
  const last = game.log.at(-1)?.id
  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [last])
  return (
    <section className="plate rivets flex min-h-0 flex-col p-3 sm:p-4" aria-label="Match log">
      <h2 className="eyebrow mb-2.5">Match log</h2>
      <ol ref={listRef} className="flex max-h-64 flex-col gap-1.5 overflow-y-auto pr-1 text-sm lg:max-h-80" aria-live="polite" aria-relevant="additions">
        {game.log.map((entry) => {
          const player = entry.player === null ? null : game.players[entry.player]
          const style = player ? PLAYER_STYLE[player.color] : null
          const system = entry.player === null
          return (
            <li key={entry.id} className={`flex gap-2 leading-snug ${entry.kind === 'era' ? 'rounded-md bg-bronze-500/15 px-1.5 py-1' : ''}`}>
              <span
                aria-hidden="true"
                className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full"
                style={{ background: style ? style.hex : 'var(--color-soot-700)', color: style ? '#1a130d' : 'var(--color-parchment-300)' }}
              >
                <svg viewBox="0 0 16 16" className="size-3" fill="currentColor">
                  <path d={ICONS[entry.kind]} fillRule="evenodd" />
                </svg>
              </span>
              <span className={system ? (entry.kind === 'era' ? 'font-semibold text-brass-200' : 'text-parchment-400 italic') : 'text-parchment-200'}>
                {colorBlind && style && <span className="mr-1 font-display text-xs font-bold text-parchment-400">[{style.letter}]</span>}
                {entry.text}
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
