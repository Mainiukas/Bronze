import { useEffect, useState } from 'react'
import type { Industry } from '../../data/board'

/**
 * The board's image files. Each is optional: whatever is present in assets/
 * is bundled, and anything missing (or failing to load) falls back to drawn
 * SVG, so art can be swapped by replacing a file.
 *
 * - assets/map.png, else assets/map.webp: the painted map
 * - assets/icons/{loom,anchor,shipyard,iron,coal}.png: industry icons
 * - assets/textures/{rail,canal}.png: route textures, seamless left to right
 * - assets/hubs/<hub id>.png: the scene inside a trade hub's medallion
 */

const MAPS = import.meta.glob<string>('../../../assets/map.{png,webp}', { eager: true, import: 'default' })
const ICONS = import.meta.glob<string>('../../../assets/icons/*.png', { eager: true, import: 'default' })
const TEXTURES = import.meta.glob<string>('../../../assets/textures/*.png', { eager: true, import: 'default' })
const HUBS = import.meta.glob<string>('../../../assets/hubs/*.png', { eager: true, import: 'default' })

const file = (files: Record<string, string>, name: string): string | undefined =>
  Object.entries(files).find(([path]) => path.endsWith(`/${name}`))?.[1]

export const MAP_URL = file(MAPS, 'map.png') ?? file(MAPS, 'map.webp') ?? ''

const ICON_FILES: Record<Industry, string> = {
  cotton: 'loom.png',
  port: 'anchor.png',
  shipyard: 'shipyard.png',
  iron: 'iron.png',
  coal: 'coal.png',
}

export const ICON_URLS: Partial<Record<Industry, string>> = Object.fromEntries(
  Object.entries(ICON_FILES).map(([industry, name]) => [industry, file(ICONS, name)]),
)

export const TEXTURE_URLS = { rail: file(TEXTURES, 'rail.png'), canal: file(TEXTURES, 'canal.png') }

export const hubSceneUrl = (hubId: string) => file(HUBS, `${hubId}.png`)

/* ---- Load checks ---------------------------------------------------------- */

const loaded = new Map<string, boolean>()
const pending = new Map<string, Promise<boolean>>()

function probe(url: string): Promise<boolean> {
  const known = loaded.get(url)
  if (known !== undefined) return Promise.resolve(known)
  let promise = pending.get(url)
  if (!promise) {
    promise = new Promise<boolean>((resolve) => {
      const img = new Image()
      img.onload = () => resolve(true)
      img.onerror = () => resolve(false)
      img.src = url
    }).then((ok) => {
      loaded.set(url, ok)
      return ok
    })
    pending.set(url, promise)
  }
  return promise
}

/**
 * Which of these image URLs can be drawn. Missing URLs count as unusable; a
 * URL is assumed usable while it loads, so textures appear without a flash of
 * the fallback, and only drops to the fallback if it fails.
 */
export function useUsableImages(urls: readonly (string | undefined)[]): Set<string> {
  const key = urls.filter(Boolean).join('\n')
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set(urls.filter((u): u is string => !!u && loaded.get(u) === false)))
  useEffect(() => {
    if (typeof Image === 'undefined') return
    let alive = true
    for (const url of key.split('\n').filter(Boolean)) {
      void probe(url).then((ok) => {
        if (alive && !ok) setFailed((prev) => (prev.has(url) ? prev : new Set([...prev, url])))
      })
    }
    return () => {
      alive = false
    }
  }, [key])
  return new Set(urls.filter((u): u is string => !!u && !failed.has(u)))
}
