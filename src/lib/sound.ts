/**
 * Synthesised sound effects and a quiet ambient loop, built with the Web
 * Audio API so there are no audio files to ship. Browsers only allow audio
 * after the player has interacted with the page; until then calls are no-ops.
 */

export type SoundEffect = 'build' | 'link' | 'ship' | 'coins' | 'turn' | 'error' | 'end' | 'click'

let context: AudioContext | null = null
let effectsGain: GainNode | null = null
let musicGain: GainNode | null = null
let musicNodes: AudioScheduledSourceNode[] = []
let volumes = { master: 0.8, music: 0.6 }
let musicWanted = false

/** Browsers refuse audio until the page has been clicked or typed in. */
function userHasInteracted(): boolean {
  return navigator.userActivation ? navigator.userActivation.hasBeenActive : true
}

// If music was asked for before any interaction, start it on the first one.
if (typeof window !== 'undefined') {
  const onFirstInteraction = () => {
    if (musicWanted) startMusic()
  }
  window.addEventListener('pointerdown', onFirstInteraction, { once: true })
  window.addEventListener('keydown', onFirstInteraction, { once: true })
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null
  if (!context) {
    if (!userHasInteracted()) return null
    try {
      context = new AudioContext()
      effectsGain = context.createGain()
      musicGain = context.createGain()
      effectsGain.connect(context.destination)
      musicGain.connect(context.destination)
      applyVolumes()
    } catch {
      context = null
      return null
    }
  }
  if (context.state === 'suspended') void context.resume().catch(() => {})
  return context
}

function applyVolumes() {
  if (!context || !effectsGain || !musicGain) return
  effectsGain.gain.setTargetAtTime(volumes.master * 0.5, context.currentTime, 0.05)
  musicGain.gain.setTargetAtTime(volumes.master * volumes.music * 0.12, context.currentTime, 0.3)
}

/** Volumes from settings, each 0–100. */
export function setVolumes(master: number, music: number) {
  volumes = { master: master / 100, music: music / 100 }
  applyVolumes()
}

/** A short tone with an attack/decay envelope. */
function tone(ctx: AudioContext, freq: number, start: number, length: number, type: OscillatorType, level = 0.4) {
  const osc = ctx.createOscillator()
  const env = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  env.gain.setValueAtTime(0.0001, start)
  env.gain.exponentialRampToValueAtTime(level, start + 0.01)
  env.gain.exponentialRampToValueAtTime(0.0001, start + length)
  osc.connect(env).connect(effectsGain!)
  osc.start(start)
  osc.stop(start + length + 0.05)
}

/** A burst of filtered noise, for clanks and thuds. */
function noise(ctx: AudioContext, start: number, length: number, cutoff: number, level = 0.5) {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * length), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2
  const source = ctx.createBufferSource()
  const filter = ctx.createBiquadFilter()
  const env = ctx.createGain()
  source.buffer = buffer
  filter.type = 'bandpass'
  filter.frequency.value = cutoff
  env.gain.value = level
  source.connect(filter).connect(env).connect(effectsGain!)
  source.start(start)
}

export function playSound(effect: SoundEffect) {
  if (volumes.master <= 0) return
  const ctx = audio()
  if (!ctx) return
  const t = ctx.currentTime + 0.01
  switch (effect) {
    case 'build': // hammer on an anvil
      noise(ctx, t, 0.18, 2400, 0.7)
      tone(ctx, 1320, t, 0.35, 'triangle', 0.18)
      tone(ctx, 1980, t, 0.25, 'sine', 0.08)
      break
    case 'link': // two rising clicks along the line
      noise(ctx, t, 0.08, 900, 0.5)
      noise(ctx, t + 0.12, 0.08, 1300, 0.5)
      tone(ctx, 440, t + 0.12, 0.2, 'triangle', 0.12)
      break
    case 'ship': // horn
      tone(ctx, 196, t, 0.5, 'sawtooth', 0.08)
      tone(ctx, 294, t, 0.5, 'triangle', 0.1)
      break
    case 'coins':
      tone(ctx, 1568, t, 0.12, 'square', 0.05)
      tone(ctx, 2093, t + 0.08, 0.2, 'square', 0.05)
      break
    case 'turn': // soft bell
      tone(ctx, 880, t, 0.8, 'sine', 0.15)
      tone(ctx, 1320, t, 0.6, 'sine', 0.05)
      break
    case 'error':
      tone(ctx, 140, t, 0.2, 'square', 0.08)
      break
    case 'end': // brass chord
      for (const [i, f] of [262, 330, 392, 523].entries()) tone(ctx, f, t + i * 0.08, 1.4, 'triangle', 0.12)
      break
    case 'click':
      noise(ctx, t, 0.03, 3000, 0.25)
      break
  }
}

/** Start the low ambient drone (a machine-hall hum with a slow swell). */
export function startMusic() {
  musicWanted = true
  const ctx = audio()
  if (!ctx || !musicGain || musicNodes.length) return
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 420
  filter.connect(musicGain)
  const lfo = ctx.createOscillator()
  const lfoDepth = ctx.createGain()
  lfo.frequency.value = 0.07
  lfoDepth.gain.value = 180
  lfo.connect(lfoDepth).connect(filter.frequency)
  lfo.start()
  musicNodes.push(lfo)
  for (const [freq, type] of [
    [55, 'sawtooth'],
    [82.4, 'triangle'],
    [110.3, 'sawtooth'],
    [164.8, 'sine'],
  ] as const) {
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.value = freq
    osc.detune.value = Math.random() * 8 - 4
    osc.connect(filter)
    osc.start()
    musicNodes.push(osc)
  }
}

export function stopMusic() {
  musicWanted = false
  for (const node of musicNodes) {
    try {
      node.stop()
    } catch {
      // Already stopped.
    }
  }
  musicNodes = []
}
