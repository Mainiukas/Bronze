import type { PlayerColor } from '../../game/types'
import { PLAYER_STYLE } from './glyphs'

/** A player's colour as a disc; with the colour-blind aid on, their letter inside it. */
export function PlayerSwatch({ color, letter, className = 'size-4' }: { color: PlayerColor; letter?: boolean; className?: string }) {
  const style = PLAYER_STYLE[color]
  return (
    <span
      aria-hidden="true"
      className={`inline-grid shrink-0 place-items-center rounded-full font-display text-[0.6rem] leading-none font-extrabold text-soot-950 ring-1 ring-black/40 ${className}`}
      style={{ background: style.hex }}
    >
      {letter ? style.letter : null}
    </span>
  )
}
