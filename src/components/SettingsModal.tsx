import type { CSSProperties, ReactNode } from 'react'
import { AI_SPEEDS, ANIMATION_SPEEDS, DEFAULT_SETTINGS, LANGUAGES, type GameSettings, type LanguageCode } from '../data/settings'
import { IconChevronDown, IconCog } from './icons'
import { ModalFrame } from './ModalFrame'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
  settings: GameSettings
  onChange: (settings: GameSettings) => void
}

/** Settings dialog. Saved between visits; changes apply at once, also in a match. */
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
        <SettingsGroup title="Game">
          <Choice
            id="animation-speed"
            label="Animation speed"
            description="Flashes and the shipping dot on the board."
            options={ANIMATION_SPEEDS}
            value={settings.animationSpeed}
            onChange={(value) => update('animationSpeed', value)}
          />
          <Choice
            id="ai-speed"
            label="Computer speed"
            description="The pause between a computer player’s actions."
            options={AI_SPEEDS}
            value={settings.aiSpeed}
            onChange={(value) => update('aiSpeed', value)}
          />
          <Toggle
            id="move-timer"
            label="Move timer"
            description="Each turn has a time limit; when it runs out, the rest of the turn is lost. Off: play untimed."
            checked={settings.showMoveTimer}
            onChange={(checked) => update('showMoveTimer', checked)}
          />
          <Toggle
            id="show-log"
            label="Show the match log"
            checked={settings.showLog}
            onChange={(checked) => update('showLog', checked)}
          />
          <Toggle
            id="color-blind"
            label="Colour-blind aid"
            description="Adds each player’s letter (Y, B, P, R, W) to their colour: on the board, the panels and the log."
            checked={settings.colorBlindAid}
            onChange={(checked) => update('colorBlindAid', checked)}
          />
        </SettingsGroup>

        <SettingsGroup title="Audio">
          <Toggle id="sound" label="Sound" checked={settings.soundOn} onChange={(checked) => update('soundOn', checked)} />
          <VolumeSlider
            id="master-volume"
            label="Master volume"
            value={settings.masterVolume}
            disabled={!settings.soundOn}
            onChange={(value) => update('masterVolume', value)}
          />
          <VolumeSlider
            id="music-volume"
            label="Music volume"
            value={settings.musicVolume}
            disabled={!settings.soundOn}
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

interface ChoiceProps<T extends string> {
  id: string
  label: string
  description?: string
  options: readonly T[]
  value: T
  onChange: (value: T) => void
}

/** A row of mutually exclusive options. */
function Choice<T extends string>({ id, label, description, options, value, onChange }: ChoiceProps<T>) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div>
        <span id={`${id}-label`} className="block font-medium text-parchment-100">
          {label}
        </span>
        {description && <span className="block text-sm text-parchment-400">{description}</span>}
      </div>
      <div role="radiogroup" aria-labelledby={`${id}-label`} className="flex overflow-hidden rounded-lg border border-bronze-500/35">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={value === option}
            onClick={() => onChange(option)}
            className={`min-h-10 px-3 text-sm font-semibold tracking-wide capitalize transition ${
              value === option ? 'bg-bronze-500/35 text-parchment-50' : 'text-parchment-400 hover:text-parchment-100'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}

interface VolumeSliderProps {
  id: string
  label: string
  value: number
  disabled?: boolean
  onChange: (value: number) => void
}

function VolumeSlider({ id, label, value, disabled = false, onChange }: VolumeSliderProps) {
  return (
    <div className={disabled ? 'opacity-45' : undefined}>
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
        disabled={disabled}
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
