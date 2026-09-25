import type { ReactNode } from 'react'
import { Gear } from './Gear'

interface ComingSoonProps {
  title: string
  /** One line describing what the page will hold. */
  blurb: string
  icon: ReactNode
}

/** Shared placeholder layout for tabs that aren't built yet. */
export function ComingSoon({ title, blurb, icon }: ComingSoonProps) {
  return (
    <section className="mx-auto flex max-w-2xl animate-fade-up flex-col items-center px-4 py-16 text-center sm:py-24">
      {/* Emblem: icon inside a slowly turning gear */}
      <div className="relative mb-8 grid size-40 place-items-center">
        <Gear teeth={16} holes={0} className="absolute inset-0 animate-spin-slow text-bronze-500/25" />
        <div className="absolute inset-5 rounded-full bg-soot-950 shadow-[inset_0_0_24px_rgb(0_0_0/0.9),0_0_40px_-6px_rgb(255_122_26/0.4)]" />
        <span className="relative text-6xl text-bronze-300 drop-shadow-[0_0_14px_rgb(255_157_77/0.5)]">{icon}</span>
      </div>

      <h1 className="metal-text font-display text-6xl font-extrabold tracking-[0.12em] uppercase sm:text-7xl">
        {title}
      </h1>
      <p className="mt-5 inline-flex items-center gap-3 rounded-full border border-bronze-400/40 bg-soot-900/80 px-5 py-2 font-display text-lg font-bold tracking-[0.3em] text-brass-300 uppercase shadow-[0_0_24px_-8px_rgb(255_157_77/0.6)]">
        <span className="size-2 animate-pulse rounded-full bg-ember-400 shadow-[0_0_8px_rgb(255_157_77)]" />
        Coming soon
      </p>
      <p className="mt-5 max-w-md text-parchment-300">{blurb}</p>
    </section>
  )
}
