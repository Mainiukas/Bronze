/**
 * Player colours: the five colours the built-link tokens come in, so a
 * player's tiles, tokens and markers all match.
 */
export const SEATS = [
  { color: '#dab345', token: 'yellow' },
  { color: '#4971ad', token: 'blue' },
  { color: '#a96dad', token: 'purple' },
  { color: '#bd4d49', token: 'red' },
  { color: '#e1dfd8', token: 'white' },
] as const

/** Colour for a seat (0-based). */
export function seatColor(seat: number): string {
  return SEATS[seat % SEATS.length].color
}
