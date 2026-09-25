/**
 * Top-level tabs shown in the top bar. App.tsx maps each path to a page.
 */

export const PATHS = {
  mainMenu: '/',
  locker: '/locker',
  shop: '/shop',
  achievements: '/achievements',
  tournaments: '/tournaments',
  /** The match screen (not a tab). */
  play: '/play',
} as const

export interface NavTab {
  readonly path: string
  /** Display label. The tab bar renders it uppercase. */
  readonly label: string
}

export const NAV_TABS: readonly NavTab[] = [
  { path: PATHS.mainMenu, label: 'Main Menu' },
  { path: PATHS.locker, label: 'Locker' },
  { path: PATHS.shop, label: 'Shop' },
  { path: PATHS.achievements, label: 'Achievements' },
  { path: PATHS.tournaments, label: 'Tournaments' },
]
