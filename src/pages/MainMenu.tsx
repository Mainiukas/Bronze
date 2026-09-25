import type { ReactNode } from 'react'
import { MapCard } from '../components/MapCard'
import { ModeCard } from '../components/ModeCard'
import { PlayButton } from '../components/PlayButton'
import { formatDuration, GAME_MODES, getGameMode, type GameModeId } from '../data/gameModes'
import { formatPlayers, getMap, MAPS, type MapId } from '../data/maps'
import { useToast } from '../hooks/useToast'

interface MainMenuProps {
  modeId: GameModeId
  onModeChange: (id: GameModeId) => void
  mapId: MapId
  onMapChange: (id: MapId) => void
}

/**
 * Lobby screen: title, PLAY button, and the mode and map selectors.
 * Selection state is owned by App so it survives tab switches.
 *
 * Desktop: hero + PLAY on the left (sticky), selectors on the right.
 * Mobile: stacked, with PLAY pinned to the bottom of the screen.
 */
export function MainMenu({ modeId, onModeChange, mapId, onMapChange }: MainMenuProps) {
  const notify = useToast()
  const mode = getGameMode(modeId)
  const map = getMap(mapId)

  const handlePlay = () => {
    notify(`Starting ${mode.name} on ${map.name} — gameplay coming soon`)
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-10 px-4 pt-8 pb-40 sm:px-6 lg:grid-cols-12 lg:gap-x-10 lg:pt-14 lg:pb-16">
      {/* Hero */}
      {/* No transform/animation on this section itself: it would become the
          containing block for the fixed mobile PLAY bar and trap it here. */}
      <section className="flex flex-col items-center text-center lg:sticky lg:top-28 lg:col-span-5 lg:items-start lg:self-start lg:text-left">
        <p className="eyebrow animate-fade-up">An industrial-era strategy game</p>
        <h1 className="metal-text mt-2 animate-sheen font-display text-[5rem] leading-[0.85] font-extrabold tracking-[0.08em] drop-shadow-[0_6px_30px_rgb(255_122_26/0.35)] sm:text-[7rem] lg:text-[6.5rem] xl:text-[8rem]">
          BRONZE
        </h1>
        <p className="mt-4 flex animate-fade-up items-center gap-3 font-display text-sm font-semibold tracking-[0.22em] whitespace-nowrap text-parchment-200 uppercase sm:text-lg sm:tracking-[0.3em]">
          <span aria-hidden="true" className="hidden h-px w-8 bg-linear-to-r from-transparent to-bronze-400 sm:block lg:hidden" />
          Build. Connect. Industrialize.
          <span aria-hidden="true" className="hidden h-px w-8 bg-linear-to-l from-transparent to-bronze-400 sm:block" />
        </p>

        {/* Current selection (desktop only; on mobile the PLAY button shows it) */}
        <dl className="plate rivets mt-10 hidden w-full animate-fade-up grid-cols-[auto_1fr] gap-x-6 gap-y-3 px-6 py-5 text-left lg:grid">
          <SummaryRow label="Mode">
            {mode.name} <span className="text-parchment-400">· {formatDuration(mode.durationMinutes)}</span>
          </SummaryRow>
          <SummaryRow label="Map">
            {map.name} <span className="text-parchment-400">· {formatPlayers(map.players)}</span>
          </SummaryRow>
          <SummaryRow label="Turn timer">{mode.turnTimerSeconds}s per turn</SummaryRow>
        </dl>

        {/* PLAY: pinned to the bottom on mobile, inline on desktop */}
        <div className="fixed inset-x-0 bottom-0 z-20 bg-linear-to-t from-soot-950 via-soot-950/90 to-transparent px-4 pt-8 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 lg:static lg:mt-6 lg:w-full lg:bg-none lg:p-0">
          <div className="mx-auto max-w-md animate-fade-up lg:max-w-none">
            <PlayButton onClick={handlePlay} subtitle={`${mode.name} · ${map.name}`} />
          </div>
        </div>
      </section>

      {/* Selectors */}
      <div className="flex animate-fade-up flex-col gap-10 [animation-delay:120ms] lg:col-span-7">
        <fieldset>
          <SectionLegend index="01" title="Game Mode" />
          <div className="grid gap-3 sm:grid-cols-3">
            {GAME_MODES.map((gameMode) => (
              <ModeCard
                key={gameMode.id}
                mode={gameMode}
                selected={gameMode.id === modeId}
                onSelect={() => onModeChange(gameMode.id)}
              />
            ))}
          </div>
        </fieldset>

        <fieldset>
          <SectionLegend index="02" title="Map" />
          <div className="grid gap-3 sm:grid-cols-3">
            {MAPS.map((gameMap) => (
              <MapCard
                key={gameMap.id}
                map={gameMap}
                selected={gameMap.id === mapId}
                onSelect={() => onMapChange(gameMap.id)}
              />
            ))}
          </div>
        </fieldset>
      </div>
    </div>
  )
}

/** Numbered section heading, used as the fieldset's legend. */
function SectionLegend({ index, title }: { index: string; title: string }) {
  return (
    <legend className="mb-4 flex w-full items-center gap-3">
      <span aria-hidden="true" className="font-display text-sm font-bold tracking-[0.2em] text-bronze-400">
        {index}
      </span>
      <span className="font-display text-2xl font-extrabold tracking-[0.14em] text-parchment-50 uppercase">
        {title}
      </span>
      <span aria-hidden="true" className="h-px flex-1 bg-linear-to-r from-bronze-500/50 to-transparent" />
    </legend>
  )
}

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="eyebrow self-center">{label}</dt>
      <dd className="font-display text-lg font-semibold tracking-wide text-parchment-50">{children}</dd>
    </>
  )
}
