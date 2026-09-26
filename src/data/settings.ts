/**
 * Player settings: shape, defaults, and validation of saved values.
 */

export const LANGUAGES = [{ code: 'en', label: 'English' }] as const

export type LanguageCode = (typeof LANGUAGES)[number]['code']

export const ANIMATION_SPEEDS = ['slow', 'normal', 'fast', 'off'] as const
export type AnimationSpeed = (typeof ANIMATION_SPEEDS)[number]
export const AI_SPEEDS = ['slow', 'normal', 'fast'] as const
export type AISpeed = (typeof AI_SPEEDS)[number]

/** How long board animations last, relative to normal (0 = no animation). */
export const ANIMATION_SCALE: Record<AnimationSpeed, number> = { slow: 1.6, normal: 1, fast: 0.5, off: 0 }
/** How long the computer players pause between actions, relative to the mode's pause. */
export const AI_DELAY_SCALE: Record<AISpeed, number> = { slow: 1.8, normal: 1, fast: 0.4 }

export interface GameSettings {
  soundOn: boolean
  /** 0–100 */
  masterVolume: number
  /** 0–100 */
  musicVolume: number
  language: LanguageCode
  showMoveTimer: boolean
  animationSpeed: AnimationSpeed
  aiSpeed: AISpeed
  showLog: boolean
  /** Adds each player's letter (P, R, Y, B, W) wherever their colour is shown. */
  colorBlindAid: boolean
}

export const DEFAULT_SETTINGS: GameSettings = {
  soundOn: true,
  masterVolume: 80,
  musicVolume: 60,
  language: 'en',
  showMoveTimer: true,
  animationSpeed: 'normal',
  aiSpeed: 'normal',
  showLog: true,
  colorBlindAid: false,
}

function isLanguageCode(value: unknown): value is LanguageCode {
  return LANGUAGES.some((language) => language.code === value)
}

function toVolume(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(100, Math.max(0, Math.round(value)))
    : fallback
}

const oneOf = <T extends string>(options: readonly T[], value: unknown, fallback: T): T =>
  options.includes(value as T) ? (value as T) : fallback
const bool = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback)

/**
 * Turn whatever was saved in storage into valid settings. Missing or invalid
 * fields fall back to their defaults, so old saves keep working when new
 * settings are added.
 */
export function parseSettings(raw: unknown): GameSettings | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const saved = raw as Partial<Record<keyof GameSettings, unknown>>
  const d = DEFAULT_SETTINGS
  return {
    soundOn: bool(saved.soundOn, d.soundOn),
    masterVolume: toVolume(saved.masterVolume, d.masterVolume),
    musicVolume: toVolume(saved.musicVolume, d.musicVolume),
    language: isLanguageCode(saved.language) ? saved.language : d.language,
    showMoveTimer: bool(saved.showMoveTimer, d.showMoveTimer),
    animationSpeed: oneOf(ANIMATION_SPEEDS, saved.animationSpeed, d.animationSpeed),
    aiSpeed: oneOf(AI_SPEEDS, saved.aiSpeed, d.aiSpeed),
    showLog: bool(saved.showLog, d.showLog),
    colorBlindAid: bool(saved.colorBlindAid, d.colorBlindAid),
  }
}
