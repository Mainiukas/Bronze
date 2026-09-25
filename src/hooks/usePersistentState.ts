import { useEffect, useState } from 'react'
import { readStorage, writeStorage } from '../lib/storage'

/**
 * useState that is initialised from, and saved back to, localStorage.
 *
 * `parse` validates the stored value and returns undefined when it is
 * unusable (wrong type, a map id that no longer exists, ...), in which case
 * `fallback` is used instead.
 */
export function usePersistentState<T>(
  key: string,
  fallback: T,
  parse: (raw: unknown) => T | undefined,
) {
  const [value, setValue] = useState<T>(() => {
    const raw = readStorage(key)
    return (raw === undefined ? undefined : parse(raw)) ?? fallback
  })

  useEffect(() => {
    writeStorage(key, value)
  }, [key, value])

  return [value, setValue] as const
}
