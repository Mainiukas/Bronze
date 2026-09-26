/**
 * Safe localStorage helpers.
 *
 * Storage can be missing or throw (private browsing, blocked cookies, quota
 * exceeded, sandboxed iframes). Every access is wrapped in try/catch so the
 * app keeps working with in-memory state only.
 */

export const STORAGE_KEYS = {
  gameMode: 'bronze.lobby.gameMode',
  map: 'bronze.lobby.map',
  settings: 'bronze.settings',
  match: 'bronze.match',
  stats: 'bronze.stats',
  /** Unsaved calibration from the map board editor. */
  boardDraft: 'bronze.boardDraft',
} as const

/** Read and JSON-parse a value. Returns undefined if absent or unreadable. */
export function readStorage(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key)
    return raw === null ? undefined : (JSON.parse(raw) as unknown)
  } catch {
    return undefined
  }
}

/** JSON-serialize and write a value. Failures are ignored. */
export function writeStorage(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage unavailable or full: keep going with in-memory state.
  }
}
