import type { PlayerColor } from '../../game/types'

/**
 * Player colours: the five colours the built-link tokens come in, so a
 * player's tiles, tokens and markers all match. `letter` is shown next to
 * the colour when the colour-blind aid is on.
 */
export const PLAYER_STYLE: Record<PlayerColor, { hex: string; letter: string; name: string }> = {
  yellow: { hex: '#dab345', letter: 'Y', name: 'Yellow' },
  blue: { hex: '#4971ad', letter: 'B', name: 'Blue' },
  purple: { hex: '#a96dad', letter: 'P', name: 'Purple' },
  red: { hex: '#bd4d49', letter: 'R', name: 'Red' },
  white: { hex: '#e1dfd8', letter: 'W', name: 'White' },
}

/** Hex colour → token colour name, for picking token art. */
export const SEATS = Object.entries(PLAYER_STYLE).map(([token, style]) => ({ color: style.hex, token: token as PlayerColor }))

/** Colour for a seat index when no player colours are known (the map sandbox). */
export function seatColor(seat: number): string {
  return SEATS[seat % SEATS.length].color
}

export const colorHex = (color: PlayerColor) => PLAYER_STYLE[color].hex
