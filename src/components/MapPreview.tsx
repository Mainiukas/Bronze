import type { MapBoardData, MapLandmark } from '../data/maps'

interface MapPreviewProps {
  board: MapBoardData
  /** Highlight the network (used for the selected map). */
  active?: boolean
}

/**
 * Schematic SVG drawing of a map, generated from the map's data:
 * hills as contour rings, water, canal and rail links, landmarks and towns.
 */
export function MapPreview({ board, active = false }: MapPreviewProps) {
  const towns = new Map(board.towns.map((town) => [town.id, town]))

  return (
    <svg viewBox="0 0 160 100" className="block h-full w-full" aria-hidden="true" focusable="false">
      {/* Hills: three contour rings each */}
      {board.hills?.map((hill, i) =>
        [1, 0.68, 0.36].map((k) => (
          <ellipse
            key={`${i}-${k}`}
            cx={hill.x}
            cy={hill.y}
            rx={hill.rx * k}
            ry={hill.ry * k}
            className="fill-none stroke-parchment-300/25"
            strokeWidth={0.7}
          />
        )),
      )}

      {/* Water */}
      {board.water?.map((water, i) =>
        water.fill ? (
          <path key={i} d={water.path} className="fill-verdigris-500/40 stroke-verdigris-400/60" strokeWidth={0.6} />
        ) : (
          <path
            key={i}
            d={water.path}
            className="fill-none stroke-verdigris-500/70"
            strokeWidth={water.width ?? 3}
            strokeLinecap="round"
          />
        ),
      )}

      {/* Links */}
      <g
        className={`transition-[color,filter] duration-300 ${
          active ? 'text-brass-300 drop-shadow-[0_0_2px_rgb(255_157_77/0.9)]' : 'text-bronze-400/70'
        }`}
      >
        {board.links.map((link) => {
          const a = towns.get(link.from)
          const b = towns.get(link.to)
          if (!a || !b) return null
          const key = `${link.from}-${link.to}`
          return link.kind === 'canal' ? (
            <line
              key={key}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className="stroke-verdigris-300"
              strokeWidth={1.3}
              strokeDasharray="3 2"
              strokeLinecap="round"
            />
          ) : (
            <g key={key} stroke="currentColor">
              {/* Sleepers under the rail line */}
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={2.6} strokeDasharray="0.6 1.8" opacity={0.6} />
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={1} />
            </g>
          )
        })}
      </g>

      {/* Landmarks */}
      {board.landmarks?.map((landmark, i) => <Landmark key={i} {...landmark} />)}

      {/* Towns */}
      {board.towns.map((town) => {
        const r = town.market ? 4 : 2.7
        return (
          <g key={town.id}>
            {active && town.market && (
              <circle cx={town.x} cy={town.y} r={r} className="map-town-pulse fill-none stroke-ember-400" strokeWidth={0.8} />
            )}
            <circle
              cx={town.x}
              cy={town.y}
              r={r}
              className={`fill-soot-900 transition-colors duration-300 ${active ? 'stroke-brass-200' : 'stroke-bronze-300'}`}
              strokeWidth={1.2}
            />
            <circle
              cx={town.x}
              cy={town.y}
              r={town.market ? 1.7 : 1}
              className={active ? 'fill-ember-300' : 'fill-bronze-300'}
            />
          </g>
        )
      })}
    </svg>
  )
}

/** Small pictogram for a landmark. */
function Landmark({ kind, x, y }: MapLandmark) {
  switch (kind) {
    case 'mine':
      // Pithead: a triangle over a shaft
      return (
        <g className="fill-none stroke-parchment-300/60" strokeWidth={0.7} strokeLinejoin="round">
          <path d={`M${x - 3} ${y + 2.5} L${x} ${y - 2.5} L${x + 3} ${y + 2.5} Z M${x} ${y - 2.5} V${y + 2.5}`} />
        </g>
      )
    case 'mill':
      // Mill: a block with a chimney
      return (
        <g className="fill-soot-800 stroke-parchment-300/60" strokeWidth={0.7} strokeLinejoin="round">
          <path d={`M${x - 3} ${y + 2.5} V${y - 0.5} L${x} ${y - 2} V${y - 0.5} L${x + 1.5} ${y - 1.3} V${y - 4.5} H${x + 3} V${y + 2.5} Z`} />
        </g>
      )
    case 'dock':
      // Anchor-like mark
      return (
        <g className="fill-none stroke-parchment-200/70" strokeWidth={0.7} strokeLinecap="round">
          <circle cx={x} cy={y - 2.4} r={0.9} />
          <path d={`M${x} ${y - 1.5} V${y + 2.5} M${x - 2.5} ${y + 0.8} Q${x - 2} ${y + 2.8} ${x} ${y + 2.5} Q${x + 2} ${y + 2.8} ${x + 2.5} ${y + 0.8}`} />
        </g>
      )
  }
}
