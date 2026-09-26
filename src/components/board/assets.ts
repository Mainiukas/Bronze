import { useEffect, useState } from 'react'
import type { Era, Industry } from '../../data/board'

/**
 * The board's image files, bundled by Vite. All are preloaded before the
 * board first renders; any that are missing or fail to load are logged and
 * replaced by a drawn fallback, so art can be swapped by replacing a file.
 *
 * - assets/map.png, else assets/map.webp: the painted map
 * - assets/icons/{loom,anchor,shipyard,iron,coal}.png: industry icons (the only industry icons in the game)
 * - assets/textures/{rail,canal}.png: route textures, seamless left to right
 * - assets/tokens/link_space.png: an empty link's connection bubble (link_symbol.png is its fallback's symbol)
 * - assets/tokens/hex_link.png: the two link hexagons on stops and hubs
 * - assets/tokens/token_{canal,rail}_<colour>.png: built links, per player colour
 * - assets/tokens/art_{boat,locomotive}.png: token art for other colours
 * - assets/hubs/<hub id>.png: the photo in a trade hub's medallion
 */

const MAPS = import.meta.glob<string>('../../../assets/map.{png,webp}', { eager: true, import: 'default' })
const ICONS = import.meta.glob<string>('../../../assets/icons/*.png', { eager: true, import: 'default' })
const TEXTURES = import.meta.glob<string>('../../../assets/textures/*.png', { eager: true, import: 'default' })
const TOKENS = import.meta.glob<string>('../../../assets/tokens/*.png', { eager: true, import: 'default' })
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

export const INDUSTRY_ICON_URLS = Object.fromEntries(
  Object.entries(ICON_FILES).map(([industry, name]) => [industry, file(ICONS, name)]),
) as Record<Industry, string | undefined>

export const TEXTURE_URLS: Record<Era, string | undefined> = { rail: file(TEXTURES, 'rail.png'), canal: file(TEXTURES, 'canal.png') }

export const LINK_SPACE_URL = file(TOKENS, 'link_space.png')
export const LINK_SYMBOL_URL = file(TOKENS, 'link_symbol.png')
export const HEX_LINK_URL = file(TOKENS, 'hex_link.png')
export const TOKEN_ART_URLS: Record<Era, string | undefined> = { canal: file(TOKENS, 'art_boat.png'), rail: file(TOKENS, 'art_locomotive.png') }

/** The colours built-link tokens come in. */
export const TOKEN_COLORS = ['purple', 'red', 'yellow', 'blue', 'white'] as const
export type TokenColor = (typeof TOKEN_COLORS)[number]

export const TOKEN_URLS = Object.fromEntries(
  (['canal', 'rail'] as const).map((era) => [era, Object.fromEntries(TOKEN_COLORS.map((c) => [c, file(TOKENS, `token_${era}_${c}.png`)]))]),
) as Record<Era, Record<TokenColor, string | undefined>>

export const hubPhotoUrl = (hubId: string) => file(HUBS, `${hubId}.png`)

/* ---- Preloading ----------------------------------------------------------- */

/** Every board image, with a readable name for warnings. */
function boardImages(): [string, string | undefined][] {
  return [
    ['map', MAP_URL || undefined],
    ...Object.entries(ICON_FILES).map(([industry, name]): [string, string | undefined] => [`icons/${name}`, INDUSTRY_ICON_URLS[industry as Industry]]),
    ['textures/rail.png', TEXTURE_URLS.rail],
    ['textures/canal.png', TEXTURE_URLS.canal],
    ['tokens/link_space.png', LINK_SPACE_URL],
    ['tokens/link_symbol.png', LINK_SYMBOL_URL],
    ['tokens/hex_link.png', HEX_LINK_URL],
    ['tokens/art_boat.png', TOKEN_ART_URLS.canal],
    ['tokens/art_locomotive.png', TOKEN_ART_URLS.rail],
    ...(['canal', 'rail'] as const).flatMap((era) => TOKEN_COLORS.map((c): [string, string | undefined] => [`tokens/token_${era}_${c}.png`, TOKEN_URLS[era][c]])),
    ...Object.keys(HUBS).map((path): [string, string | undefined] => [`hubs/${path.split('/').pop()}`, HUBS[path]]),
  ]
}

const status = new Map<string, boolean>()
let preloading: Promise<void> | null = null

/**
 * Load and decode every board image once. Safe to call repeatedly; the app
 * starts it at launch so the board is usually ready by the time it opens.
 */
export function preloadBoardImages(): Promise<void> {
  if (preloading) return preloading
  if (typeof Image === 'undefined') return (preloading = Promise.resolve())
  preloading = Promise.all(
    boardImages().map(([name, url]) => {
      if (!url) {
        console.warn(`Board image ${name} is missing; drawing a fallback instead.`)
        return Promise.resolve()
      }
      const img = new Image()
      img.src = url
      return img
        .decode()
        .then(() => void status.set(url, true))
        .catch(() => {
          status.set(url, false)
          console.warn(`Board image ${name} failed to load; drawing a fallback instead.`)
        })
    }),
  ).then(() => undefined)
  return preloading
}

/** Can this image be drawn? False for a missing file or one that failed to load. */
export const imageOk = (url: string | undefined): url is string => !!url && status.get(url) !== false

/** True once every board image has loaded (or failed and been given a fallback). */
export function useBoardImagesReady(): boolean {
  const [ready, setReady] = useState(() => typeof Image === 'undefined' || boardImages().every(([, url]) => !url || status.has(url)))
  useEffect(() => {
    if (ready) return
    let alive = true
    void preloadBoardImages().then(() => alive && setReady(true))
    return () => {
      alive = false
    }
  }, [ready])
  return ready
}
