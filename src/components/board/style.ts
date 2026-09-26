import type { Era, Industry } from '../../data/board'

/** The board's palette (the spec colours for tiles, plaques, hubs and link spaces). */
export const BOARD_COLORS = {
  tile: '#1b1b1b',
  tileEdge: '#5b4524',
  cream: '#efe6cf',
  ink: '#1a130d',
  plaque: '#cfcfca',
  plaqueEdge: '#8a8a85',
  plaqueInk: '#2a2a2a',
  ribbon: '#c9c9c4',
  iron: '#2b2b2b',
  bronze: '#a07a3c',
  space: '#1a1a1a',
  bevel: '#e8dcc0',
  glow: '#ffb45e',
  gold: '#f2c14e',
} as const

/** Ids of the SVG definitions each board declares once. */
export const DEF = {
  shadow: 'ib-shadow',
  routeShadow: 'ib-route-shadow',
  tokenShadow: 'ib-token-shadow',
  glow: 'ib-glow',
  silhouette: 'ib-silhouette',
  vignette: 'ib-vignette',
  texture: (era: Era) => `ib-texture-${era}`,
  icon: (industry: Industry) => `ib-icon-${industry}`,
}
