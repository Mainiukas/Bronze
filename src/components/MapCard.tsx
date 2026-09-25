import { formatPlayers, type GameMap } from '../data/maps'
import { IconCheck, IconUsers } from './icons'
import { MapPreview } from './MapPreview'

interface MapCardProps {
  map: GameMap
  selected: boolean
  onSelect: () => void
}

/**
 * Selectable map card with a schematic preview. Like ModeCard, it wraps a
 * visually hidden radio input for keyboard and screen-reader support.
 */
export function MapCard({ map, selected, onSelect }: MapCardProps) {
  return (
    <label
      className={`group relative grid cursor-pointer grid-cols-[7.5rem_1fr] gap-3 rounded-xl border p-3 transition duration-200 ease-out select-none has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brass-300 sm:grid-cols-1 ${
        selected
          ? 'border-bronze-300/80 bg-linear-to-b from-bronze-500/25 via-soot-800/90 to-soot-900/90 shadow-[0_0_0_1px_rgb(232_181_124/0.35),0_12px_32px_-12px_rgb(255_122_26/0.55)] sm:-translate-y-1'
          : 'border-bronze-500/20 bg-soot-900/70 hover:-translate-y-0.5 hover:border-bronze-400/50 hover:bg-soot-800/80 active:translate-y-0 active:scale-[0.98]'
      }`}
    >
      <input type="radio" name="map" value={map.id} checked={selected} onChange={onSelect} className="sr-only" />

      {/* Preview on a blueprint-grid panel */}
      <span
        className={`relative block aspect-[16/10] self-start overflow-hidden rounded-lg border bg-soot-950 bg-[linear-gradient(to_right,rgb(232_181_124/0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgb(232_181_124/0.06)_1px,transparent_1px)] bg-size-[10%_16%] transition-colors duration-200 ${
          selected ? 'border-bronze-300/50' : 'border-bronze-500/20'
        }`}
      >
        <span className="block h-full w-full p-1.5 transition-transform duration-500 ease-out group-hover:scale-105">
          <MapPreview preview={map.preview} active={selected} />
        </span>
        <span className="absolute top-1.5 left-1.5 rounded bg-soot-950/80 px-1.5 py-0.5 font-display text-[0.65rem] font-semibold tracking-[0.2em] text-bronze-200 uppercase">
          {map.terrain}
        </span>
      </span>

      <span className="flex min-w-0 flex-col gap-1 sm:px-1 sm:pb-1">
        <span
          className={`font-display text-xl leading-tight font-extrabold tracking-[0.1em] uppercase transition-colors ${
            selected ? 'text-parchment-50' : 'text-parchment-200'
          }`}
        >
          {map.name}
        </span>
        <span className="text-sm leading-snug text-parchment-300">{map.flavor}</span>
        <span className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold tracking-wide text-bronze-200">
          <span className="inline-flex items-center gap-1 rounded-full border border-bronze-500/30 bg-soot-950/60 px-2 py-0.5">
            <IconUsers className="size-3.5" />
            {formatPlayers(map.players)}
          </span>
          <span className="text-parchment-400">{map.preview.towns.length} towns</span>
        </span>
      </span>

      <span
        aria-hidden="true"
        className={`absolute -top-2 -right-2 grid size-6 place-items-center rounded-full border border-soot-900 bg-linear-to-b from-brass-300 to-bronze-500 text-soot-950 shadow-[0_0_10px_rgb(255_157_77/0.7)] transition duration-200 ${
          selected ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
        }`}
      >
        <IconCheck className="size-3.5" strokeWidth={3} />
      </span>
    </label>
  )
}
