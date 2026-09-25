import type { CSSProperties } from 'react'
import { Gear } from './Gear'

/**
 * Fixed, decorative backdrop behind every page: furnace glow, a faint
 * blueprint grid, slowly turning gears, drifting smoke and rising embers.
 * Purely visual; hidden from assistive tech and ignores pointer events.
 */

/** Fixed ember positions so the scene looks the same on every render. */
const EMBERS: { left: string; size: number; duration: number; delay: number; drift: number }[] = [
  { left: '6%', size: 3, duration: 15, delay: 0, drift: 40 },
  { left: '14%', size: 2, duration: 19, delay: 6, drift: -30 },
  { left: '23%', size: 2, duration: 13, delay: 3, drift: 24 },
  { left: '31%', size: 3, duration: 21, delay: 10, drift: -20 },
  { left: '42%', size: 2, duration: 17, delay: 1, drift: 36 },
  { left: '51%', size: 2, duration: 14, delay: 8, drift: -44 },
  { left: '59%', size: 3, duration: 18, delay: 4, drift: 18 },
  { left: '67%', size: 2, duration: 16, delay: 11, drift: -26 },
  { left: '76%', size: 2, duration: 20, delay: 2, drift: 30 },
  { left: '84%', size: 3, duration: 15, delay: 7, drift: -34 },
  { left: '92%', size: 2, duration: 18, delay: 5, drift: 22 },
]

export function SceneBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-soot-950">
      <div className="scene-glow absolute inset-0" />
      <div className="scene-grid absolute inset-0" />

      {/* Gears: large, faint, slowly meshing */}
      <Gear
        teeth={18}
        className="absolute -left-40 top-[38%] size-[30rem] animate-spin-slow text-bronze-500/[0.06]"
      />
      <Gear
        teeth={11}
        holes={4}
        className="absolute left-[12rem] top-[22%] hidden size-[12rem] animate-spin-slower-reverse text-copper-400/[0.05] md:block"
      />
      <Gear
        teeth={24}
        holes={6}
        className="absolute -right-48 -bottom-56 size-[38rem] animate-spin-slower-reverse text-bronze-400/[0.06]"
      />
      <Gear
        teeth={9}
        holes={3}
        className="absolute right-[8%] top-[9%] size-[7rem] animate-spin-slow text-brass-400/[0.05]"
      />

      {/* Smoke */}
      <div className="scene-smoke -left-[10%] top-[8%] size-[55vmax]" />
      <div className="scene-smoke left-[40%] top-[35%] size-[45vmax] [animation-delay:-12s] [animation-duration:46s]" />
      <div className="scene-smoke -right-[15%] -top-[20%] size-[50vmax] [animation-delay:-24s]" />

      {/* Embers */}
      {EMBERS.map((ember) => (
        <span
          key={ember.left}
          className="scene-ember"
          style={
            {
              left: ember.left,
              width: ember.size,
              height: ember.size,
              animationDuration: `${ember.duration}s`,
              animationDelay: `-${ember.delay}s`,
              '--drift': `${ember.drift}px`,
            } as CSSProperties
          }
        />
      ))}

      <div className="scene-vignette absolute inset-0" />
    </div>
  )
}
