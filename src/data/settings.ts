/**
 * Player settings: shape, defaults, and validation of saved values.
 */

export const LANGUAGES = [{ code: 'en', label: 'English' }] as const

export type LanguageCode = (typeof LANGUAGES)[number]['code']

export interface GameSettings {
  /** 0–100 */
  masterVolume: number
  /** 0–100 */
  musicVolume: number
  language: LanguageCode
  showMoveTimer: boolean
}

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 80,
  musicVolume: 60,
  language: 'en',
  showMoveTimer: true,
}

function isLanguageCode(value: unknown): value is LanguageCode {
  return LANGUAGES.some((language) => language.code === value)
}

function toVolume(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(100, Math.max(0, Math.round(value)))
    : fallback
}

/**
 * Turn whatever was saved in storage into valid settings. Missing or invalid
 * fields fall back to their defaults, so old saves keep working when new
 * settings are added.
 */
export function parseSettings(raw: unknown): GameSettings | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const saved = raw as Partial<Record<keyof GameSettings, unknown>>
  return {
    masterVolume: toVolume(saved.masterVolume, DEFAULT_SETTINGS.masterVolume),
    musicVolume: toVolume(saved.musicVolume, DEFAULT_SETTINGS.musicVolume),
    language: isLanguageCode(saved.language) ? saved.language : DEFAULT_SETTINGS.language,
    showMoveTimer:
      typeof saved.showMoveTimer === 'boolean' ? saved.showMoveTimer : DEFAULT_SETTINGS.showMoveTimer,
  }
}
