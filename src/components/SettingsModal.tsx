import type { CSSProperties, ReactNode } from 'react'
import { DEFAULT_SETTINGS, LANGUAGES, type GameSettings, type LanguageCode } from '../data/settings'
import { IconChevronDown, IconCog } from './icons'
import { ModalFrame } from './ModalFrame'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
  settings: GameSettings
  onChange: (settings: GameSettings) => void
}

/** Settings dialog. Values are placeholders for now but are saved between visits. */
export function SettingsModal({ open, onClose, settings, onChange }: SettingsModalProps) {
  const update = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) =>
    onChange({ ...settings, [key]: value })

  return (
    <ModalFrame
      open={open}
      onClose={onClose}
      id="settings"
      title="Settings"
      icon={<IconCog />}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={() => onChange(DEFAULT_SETTINGS)}>
            Reset
          </button>
          <button type="button" className="btn btn-primary px-6" onClick={onClose}>
            Done
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <SettingsGroup title="Audio">
          <VolumeSlider
            id="master-volume"
            label="Master volume"
            value={settings.masterVolume}
            onChange={(value) => update('masterVolume', value)}
          />
          <VolumeSlider
            id="music-volume"
            label="Music volume"
            value={settings.musicVolume}
            onChange={(value) => update('musicVolume', value)}
          />
        </SettingsGroup>

        <SettingsGroup title="General">
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="language" className="font-medium text-parchment-100">
              Language
            </label>
            <div className="relative">
              <select
                id="language"
                value={settings.language}
                onChange={(event) => update('language', event.target.value as LanguageCode)}
                className="appearance-none rounded-lg border border-bronze-500/35 bg-soot-950/70 py-2 pr-9 pl-3 text-parchment-50 transition outline-none hover:border-bronze-300/60 focus-visible:border-bronze-300/80"
              >
                {LANGUAGES.map((language) => (
                  <option key={language.code} value={language.code}>
                    {language.label}
                  </option>
                ))}
              </select>
              <IconChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-bronze-300" />
            </div>
          </div>

          <Toggle
            id="move-timer"
            label="Show move timer"
            description="Display the countdown for each turn."
            checked={settings.showMoveTimer}
            onChange={(checked) => update('showMoveTimer', checked)}
          />
        </SettingsGroup>
      </div>
    </ModalFrame>
  )
}

function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="eyebrow mb-3 flex items-center gap-3">
        {title}
        <span className="h-px flex-1 bg-linear-to-r from-bronze-500/40 to-transparent" />
      </h3>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}

interface VolumeSliderProps {
  id: string
  label: string
  value: number
  onChange: (value: number) => void
}

function VolumeSlider({ id, label, value, onChange }: VolumeSliderProps) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <label htmlFor={id} className="font-medium text-parchment-100">
          {label}
        </label>
        <output htmlFor={id} className="font-display text-lg font-semibold text-bronze-300 tabular-nums">
          {value}%
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="bz-range"
        style={{ '--fill': `${value}%` } as CSSProperties}
      />
    </div>
  )
}

interface ToggleProps {
  id: string
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
}

/** On/off switch with ARIA switch semantics. */
function Toggle({ id, label, description, checked, onChange }: ToggleProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <span id={`${id}-label`} className="block font-medium text-parchment-100">
          {label}
        </span>
        {description && <span className="block text-sm text-parchment-400">{description}</span>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-13 shrink-0 rounded-full border transition-colors duration-200 ${
          checked
            ? 'border-bronze-300/70 bg-linear-to-r from-bronze-600 to-ember-500 shadow-[0_0_14px_-2px_rgb(255_122_26/0.6)]'
            : 'border-bronze-500/30 bg-soot-700'
        }`}
      >
        <span
          className={`absolute top-1/2 left-0.5 size-5.5 -translate-y-1/2 rounded-full bg-radial-[at_35%_30%] from-brass-200 to-bronze-500 shadow-[0_2px_6px_rgb(0_0_0/0.6)] transition-transform duration-200 ease-out ${
            checked ? 'translate-x-6' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}
