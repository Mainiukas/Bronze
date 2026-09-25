import type { ComponentType } from 'react'
import { formatDuration, type GameMode, type ModeIconName } from '../data/gameModes'
import { IconBolt, IconCheck, IconClock, IconFactory, IconStopwatch, type IconProps } from './icons'

const MODE_ICONS: Record<ModeIconName, ComponentType<IconProps>> = {
  factory: IconFactory,
  bolt: IconBolt,
  stopwatch: IconStopwatch,
}

interface ModeCardProps {
  mode: GameMode
  selected: boolean
  onSelect: () => void
}

/**
 * Selectable game-mode card. Built on a visually hidden radio input so the
 * group gets native keyboard support (arrow keys) and screen-reader semantics.
 */
export function ModeCard({ mode, selected, onSelect }: ModeCardProps) {
  const Icon = MODE_ICONS[mode.icon]

  return (
    <label
      // Grid areas keep every card identical. Mobile: icon on the left, name and
      // duration side by side. Wider: duration next to the icon, text below.
      className={`group relative grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] gap-x-4 gap-y-1 rounded-xl border p-4 transition duration-200 ease-out select-none [grid-template-areas:'icon_name_time'_'icon_desc_desc'] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brass-300 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-y-2 sm:[grid-template-areas:'icon_time'_'name_name'_'desc_desc'] ${
        selected
          ? 'border-bronze-300/80 bg-linear-to-b from-bronze-500/25 via-soot-800/90 to-soot-900/90 shadow-[0_0_0_1px_rgb(232_181_124/0.35),0_12px_32px_-12px_rgb(255_122_26/0.55)] sm:-translate-y-1'
          : 'border-bronze-500/20 bg-soot-900/70 hover:-translate-y-0.5 hover:border-bronze-400/50 hover:bg-soot-800/80 active:translate-y-0 active:scale-[0.98]'
      }`}
    >
      <input type="radio" name="game-mode" value={mode.id} checked={selected} onChange={onSelect} className="sr-only" />

      {/* Icon badge */}
      <span
        className={`grid size-12 shrink-0 place-items-center self-center rounded-lg border text-2xl transition duration-200 [grid-area:icon] sm:mb-1 ${
          selected
            ? 'border-brass-300/60 bg-linear-to-b from-brass-300 to-bronze-600 text-soot-950 shadow-[0_0_18px_-2px_rgb(255_157_77/0.7)]'
            : 'border-bronze-500/30 bg-soot-800 text-bronze-300 group-hover:text-bronze-200'
        }`}
      >
        <Icon />
      </span>

      <span
        className={`self-center font-display text-2xl leading-none font-extrabold tracking-[0.12em] uppercase transition-colors [grid-area:name] ${
          selected ? 'text-parchment-50' : 'text-parchment-200'
        }`}
      >
        {mode.name}
      </span>

      <span className="inline-flex items-center gap-1 self-center justify-self-end rounded-full border border-bronze-500/30 bg-soot-950/60 px-2 py-0.5 text-xs font-semibold tracking-wide whitespace-nowrap text-bronze-200 tabular-nums [grid-area:time]">
        <IconClock className="size-3.5" />
        {formatDuration(mode.durationMinutes)}
      </span>

      <span className="text-sm leading-snug text-parchment-300 [grid-area:desc]">{mode.description}</span>

      {/* Selected check */}
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
