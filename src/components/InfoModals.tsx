import { IconBook, IconStar } from './icons'
import { ModalFrame } from './ModalFrame'

interface InfoModalProps {
  open: boolean
  onClose: () => void
}

const HOW_TO_PLAY_STEPS = [
  { title: 'Build', text: 'Found workshops, forges and mills in the towns you can reach.' },
  { title: 'Connect', text: 'Lay canals and railways to link your industries to markets.' },
  { title: 'Industrialize', text: 'Sell goods, grow your income and outscore your rivals in prestige.' },
]

/** Placeholder rules overview. */
export function HowToPlayModal({ open, onClose }: InfoModalProps) {
  return (
    <ModalFrame open={open} onClose={onClose} id="how-to-play" title="How to Play" icon={<IconBook />}>
      <ol className="flex flex-col gap-4">
        {HOW_TO_PLAY_STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full border border-bronze-400/50 bg-soot-800 font-display text-xl font-bold text-bronze-300">
              {index + 1}
            </span>
            <div>
              <p className="font-display text-lg font-bold tracking-[0.1em] text-parchment-50 uppercase">{step.title}</p>
              <p className="text-parchment-300">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-6 rounded-lg border border-dashed border-bronze-500/30 bg-soot-950/50 px-4 py-3 text-sm text-parchment-300">
        The full rulebook and an interactive tutorial are coming soon.
      </p>
    </ModalFrame>
  )
}

/** Placeholder credits. */
export function CreditsModal({ open, onClose }: InfoModalProps) {
  return (
    <ModalFrame open={open} onClose={onClose} id="credits" title="Credits" icon={<IconStar />}>
      <div className="flex flex-col gap-5 text-center">
        <div>
          <p className="metal-text font-display text-4xl font-extrabold tracking-[0.2em] uppercase">Bronze</p>
          <p className="text-sm text-parchment-300">An original industrial-era strategy game</p>
        </div>
        <dl className="grid gap-3">
          {[
            ['Game design', 'The Bronze team'],
            ['Art & interface', 'The Bronze team'],
            ['Built with', 'React · TypeScript · Vite · Tailwind CSS'],
          ].map(([role, who]) => (
            <div key={role}>
              <dt className="eyebrow">{role}</dt>
              <dd className="text-parchment-100">{who}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-parchment-400">Thank you for playing the early build.</p>
      </div>
    </ModalFrame>
  )
}
