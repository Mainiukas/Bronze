import { Gear } from '../components/Gear'
import { IconCheck, IconTrophy } from '../components/icons'
import { ACHIEVEMENTS, type PlayerStats } from '../data/achievements'

/** Lifetime stats and achievements for this device. */
export function Achievements({ stats }: { stats: PlayerStats }) {
  const unlockedCount = ACHIEVEMENTS.filter((a) => stats.unlocked[a.id]).length
  const tiles = [
    { label: 'Matches', value: stats.matches },
    { label: 'Wins', value: stats.wins },
    { label: 'Best score', value: `${stats.bestScore}★` },
    { label: 'Goods shipped', value: stats.goodsShipped },
  ]

  return (
    <section className="mx-auto flex max-w-5xl animate-fade-up flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Your record</p>
          <h1 className="metal-text font-display text-5xl font-extrabold tracking-[0.1em] uppercase sm:text-6xl">
            Achievements
          </h1>
        </div>
        <p className="font-display text-xl font-bold tracking-wide text-parchment-200">
          <span className="text-brass-300">{unlockedCount}</span> / {ACHIEVEMENTS.length} unlocked
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="plate rivets px-4 py-3">
            <dt className="eyebrow">{tile.label}</dt>
            <dd className="font-display text-3xl font-extrabold text-parchment-50 tabular-nums">{tile.value}</dd>
          </div>
        ))}
      </dl>

      <ul className="grid gap-3 sm:grid-cols-2">
        {ACHIEVEMENTS.map((achievement) => {
          const date = stats.unlocked[achievement.id]
          const progress = achievement.progress?.(stats)
          return (
            <li
              key={achievement.id}
              className={`relative flex items-center gap-4 rounded-xl border p-4 ${
                date ? 'border-brass-300/50 bg-linear-to-b from-bronze-500/20 to-soot-900/90' : 'border-bronze-500/20 bg-soot-900/70'
              }`}
            >
              <span className="relative grid size-14 shrink-0 place-items-center">
                <Gear
                  teeth={12}
                  holes={0}
                  className={`absolute inset-0 ${date ? 'text-bronze-400 drop-shadow-[0_0_10px_rgb(255_157_77/0.5)]' : 'text-soot-600'}`}
                />
                <span
                  className={`relative grid size-8 place-items-center rounded-full ${date ? 'bg-soot-950 text-brass-300' : 'bg-soot-900 text-parchment-500'}`}
                >
                  {date ? <IconCheck className="size-4" strokeWidth={2.6} /> : <IconTrophy className="size-4" />}
                </span>
              </span>
              <div className="min-w-0 flex-1">
                <p className={`font-display text-lg font-bold tracking-[0.08em] uppercase ${date ? 'text-parchment-50' : 'text-parchment-300'}`}>
                  {achievement.name}
                </p>
                <p className="text-sm text-parchment-300">{achievement.description}</p>
                {date ? (
                  <p className="mt-1 text-xs text-brass-300">Unlocked {new Date(date).toLocaleDateString()}</p>
                ) : (
                  progress && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-soot-700">
                        <div
                          className="h-full rounded-full bg-linear-to-r from-bronze-500 to-ember-400"
                          style={{ width: `${(progress.value / progress.target) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-parchment-400 tabular-nums">
                        {progress.value}/{progress.target}
                      </span>
                    </div>
                  )
                )}
              </div>
            </li>
          )
        })}
      </ul>
      {stats.matches === 0 && (
        <p className="text-center text-parchment-400">Finish a match to start your record. Achievements are saved on this device.</p>
      )}
    </section>
  )
}
