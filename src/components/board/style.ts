import type { Era, Industry } from '../../data/board'

/** The board's palette (the spec colours for tiles, plaques, hubs and markers). */
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
  marker: '#1a1a1a',
  markerLine: '#e8dcc0',
  glow: '#ffb45e',
  gold: '#f2c14e',
} as const

/** Ids of the SVG definitions each board declares once. */
export const DEF = {
  shadow: 'ib-shadow',
  routeShadow: 'ib-route-shadow',
  glow: 'ib-glow',
  vignette: 'ib-vignette',
  texture: (kind: Era) => `ib-texture-${kind}`,
  icon: (industry: Industry) => `ib-icon-${industry}`,
}
