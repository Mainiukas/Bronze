import type { GameState } from '../../game/types'
import { seatColor } from './glyphs'

/** Recent events, newest first. */
export function GameLog({ game }: { game: GameState }) {
  const entries = [...game.log].reverse()
  return (
    <section className="plate rivets flex min-h-0 flex-col p-4 sm:p-5" aria-label="Match log">
      <h2 className="eyebrow mb-3">Match log</h2>
      <ol className="flex max-h-72 flex-col gap-1.5 overflow-y-auto pr-1 text-sm" aria-live="polite">
        {entries.map((entry) => (
          <li key={entry.id} className="flex gap-2.5 leading-snug">
            <span
              className="mt-1.5 size-2 shrink-0 rounded-full"
              style={{ background: entry.player === null ? 'var(--color-parchment-500)' : seatColor(entry.player) }}
            />
            <span className={entry.player === null ? 'text-parchment-400 italic' : 'text-parchment-200'}>{entry.text}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
