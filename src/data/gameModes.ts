/**
 * Game mode configuration.
 *
 * To add a mode, append an entry to GAME_MODES. Its `id` becomes part of the
 * GameModeId type automatically, and the main menu renders a card for it.
 */

/** Icons a mode card can show. Mapped to SVG components in ModeCard. */
export type ModeIconName = 'factory' | 'bolt' | 'stopwatch'

export interface GameModeConfig {
  /** Stable identifier. Saved to localStorage, so avoid renaming. */
  readonly id: string
  readonly name: string
  /** Typical match length in minutes. */
  readonly durationMinutes: { readonly min: number; readonly max: number }
  /** One-line summary shown on the card. */
  readonly description: string
  readonly icon: ModeIconName
  /** Seconds each player gets per turn (when the move timer is on). */
  readonly turnTimerSeconds: number
  /**
   * Which cut of the chosen map this mode plays on: `full` uses every town,
   * `reduced` drops the outer ring, `compact` keeps only the core.
   */
  readonly mapSize: 'full' | 'reduced' | 'compact'
  /** Number of rounds in a match. */
  readonly rounds: number
  /** Money each player starts with (£). */
  readonly startingMoney: number
  /** Pause between computer players' actions, so you can follow them (ms). */
  readonly aiDelayMs: number
}

export const GAME_MODES = [
  {
    id: 'normal',
    name: 'Normal',
    durationMinutes: { min: 60, max: 120 },
    description: 'Full map, full rules. The complete industrial saga.',
    icon: 'factory',
    turnTimerSeconds: 120,
    mapSize: 'full',
    rounds: 10,
    startingMoney: 14,
    aiDelayMs: 900,
  },
  {
    id: 'blitz',
    name: 'Blitz',
    durationMinutes: { min: 20, max: 45 },
    description: 'Smaller map and shorter timers. Every decision counts.',
    icon: 'bolt',
    turnTimerSeconds: 45,
    mapSize: 'reduced',
    rounds: 7,
    startingMoney: 16,
    aiDelayMs: 650,
  },
  {
    id: 'bullet',
    name: 'Bullet',
    durationMinutes: { min: 10, max: 15 },
    description: 'Smallest map, very short timers. Build on instinct.',
    icon: 'stopwatch',
    turnTimerSeconds: 15,
    mapSize: 'compact',
    rounds: 5,
    startingMoney: 18,
    aiDelayMs: 400,
  },
] as const satisfies readonly GameModeConfig[]

export type GameMode = (typeof GAME_MODES)[number]
export type GameModeId = GameMode['id']

export const DEFAULT_GAME_MODE_ID: GameModeId = 'normal'

/** Type guard: is `value` the id of a known mode? Used to validate saved data. */
export function isGameModeId(value: unknown): value is GameModeId {
  return GAME_MODES.some((mode) => mode.id === value)
}

/** Look up a mode by id, falling back to the default mode. */
export function getGameMode(id: GameModeId): GameMode {
  return GAME_MODES.find((mode) => mode.id === id) ?? GAME_MODES[0]
}

/** "60–120 min" */
export function formatDuration({ min, max }: GameModeConfig['durationMinutes']): string {
  return min === max ? `${min} min` : `${min}–${max} min`
}
