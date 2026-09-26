import { IconPlay } from './icons'

interface PlayButtonProps {
  onClick: () => void
  label?: string
  /** Short line under the label, e.g. "Normal · Mersey Valley". */
  subtitle?: string
}

/**
 * The big PLAY button: a brass slab with a pulsing furnace glow, a light
 * sweep on hover, and a physical "press" (the slab drops onto its ledge).
 */
export function PlayButton({ onClick, label = 'PLAY', subtitle }: PlayButtonProps) {
  return (
    <div className="relative">
      {/* Pulsing glow behind the button */}
      <div
        aria-hidden="true"
        className="absolute -inset-2 animate-glow-pulse rounded-2xl bg-ember-500/35 blur-xl"
      />
      <button
        type="button"
        onClick={onClick}
        className="group relative flex w-full items-center justify-center gap-4 overflow-hidden rounded-xl border border-brass-200/60 bg-linear-to-b from-brass-300 via-bronze-400 to-bronze-600 px-8 py-4 text-soot-950 shadow-[0_6px_0_var(--color-bronze-800),0_14px_34px_-8px_rgb(255_122_26/0.75),inset_0_1px_0_rgb(255_255_255/0.45)] transition-[transform,box-shadow,filter] duration-150 ease-out select-none hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_8px_0_var(--color-bronze-800),0_18px_44px_-8px_rgb(255_122_26/0.9),inset_0_1px_0_rgb(255_255_255/0.5)] active:translate-y-[5px] active:shadow-[0_1px_0_var(--color-bronze-800),0_6px_16px_-8px_rgb(255_122_26/0.8),inset_0_2px_6px_rgb(0_0_0/0.25)] sm:py-5"
      >
        {/* Light sweep */}
        <span
          aria-hidden="true"
          className="absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-linear-to-r from-transparent via-white/45 to-transparent opacity-0 transition-none group-hover:left-[120%] group-hover:opacity-100 group-hover:transition-[left,opacity] group-hover:duration-700 group-hover:ease-out"
        />
        {/* Machined line pattern */}
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0,transparent_3px,rgb(0_0_0/0.035)_3px,rgb(0_0_0/0.035)_4px)]"
        />

        <IconPlay className="relative size-9 drop-shadow-[0_1px_0_rgb(255_255_255/0.4)] transition-transform duration-200 group-hover:scale-110 sm:size-10" />
        <span className="relative flex flex-col items-start leading-none">
          <span className="font-display text-3xl font-extrabold tracking-[0.18em] whitespace-nowrap drop-shadow-[0_1px_0_rgb(255_255_255/0.35)] sm:text-4xl">
            {label}
          </span>
          {subtitle && (
            <span className="mt-1 font-display text-xs font-bold tracking-[0.18em] text-soot-900/75 uppercase sm:text-sm">
              {subtitle}
            </span>
          )}
        </span>
      </button>
    </div>
  )
}
