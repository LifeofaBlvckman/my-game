// Every sound is synthesized with the Web Audio API: no files to download.
// Browsers only allow audio after a click or key press, so call start() from one.

let ctx = null
let master = null
let musicGain = null
let siren = null
let horn = null
let engine = null
let musicTimer = null

export function startAudio() {
  if (ctx) return
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return
  ctx = new AC()
  master = ctx.createGain()
  master.gain.value = 0.55
  master.connect(ctx.destination)
  musicGain = ctx.createGain()
  musicGain.gain.value = 0 // setMusic() fades the chosen track in
  musicGain.connect(master)
  setupLoops()
}

function noiseBuffer() {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}
let noise = null

function envelope(gain, t, peak, decay) {
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.005)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + decay)
}

function tone(type, freq, t, decay, peak, out = master, endFreq) {
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + decay)
  envelope(g, t, peak, decay)
  o.connect(g).connect(out)
  o.start(t)
  o.stop(t + decay + 0.05)
}

function hiss(t, decay, peak, filterType, freq, out = master) {
  noise ??= noiseBuffer()
  const src = ctx.createBufferSource()
  src.buffer = noise
  const f = ctx.createBiquadFilter()
  f.type = filterType
  f.frequency.value = freq
  const g = ctx.createGain()
  envelope(g, t, peak, decay)
  src.connect(f).connect(g).connect(out)
  src.start(t, Math.random() * 0.5)
  src.stop(t + decay + 0.05)
}

// --- Music: a simple Afrobeats groove (kick, clap, shaker, log drum, keys) ---
const BPM = 104
const STEP = 60 / BPM / 4
const KICK = [0, 7, 8]
const CLAP = [4, 12]
const LOG = { 0: 55, 3: 55, 6: 65.4, 10: 49, 13: 58.3 } // step -> Hz
const CHORDS = [[220, 277.2, 329.6], [196, 246.9, 293.7], [174.6, 220, 261.6], [196, 246.9, 293.7]]

function scheduleBar(start, bar) {
  for (let s = 0; s < 16; s++) {
    const t = start + s * STEP
    if (KICK.includes(s)) tone('sine', 130, t, 0.28, 0.9, musicGain, 42)
    if (CLAP.includes(s)) hiss(t, 0.14, 0.35, 'bandpass', 1400, musicGain)
    hiss(t, 0.04, s % 4 === 2 ? 0.18 : 0.08, 'highpass', 7000, musicGain)
    if (LOG[s]) tone('triangle', LOG[s] * 2, t, 0.32, 0.5, musicGain, LOG[s] * 1.6)
    if (s === 2 || s === 10) CHORDS[bar % 4].forEach((f) => tone('square', f, t, 0.22, 0.04, musicGain))
  }
}

// --- Music: a calm theme, the default ---
// Plucked zither (guzheng-like) notes on a pentatonic scale over a soft
// drone, in a big airy room. The plucks are Karplus-Strong strings,
// synthesized once at startup into buffers.
const CALM_BPM = 68
const EIGHTH = 60 / CALM_BPM / 2
const MIDI = (n) => 440 * Math.pow(2, (n - 69) / 12)
// D major pentatonic (D E F# A B) across two octaves, plus low roots.
const MELODY = [62, 64, 66, 69, 71, 74, 76, 78, 81].map(MIDI)
const ROOTS = [50, 47, 43, 45].map(MIDI) // D, B, G, A: one per bar
const DRONE = [[50, 57], [47, 54], [43, 50], [45, 52]].map((c) => c.map(MIDI))
let plucks = null
let reverb = null
let calmGain = null
let calmMelody = { note: 4, rest: 0 }

function pluckBuffer(freq, seconds = 2.6, damping = 0.996) {
  const rate = ctx.sampleRate
  const out = ctx.createBuffer(1, Math.floor(rate * seconds), rate)
  const data = out.getChannelData(0)
  const period = rate / freq
  const n = Math.floor(period)
  const frac = period - n
  const line = new Float32Array(n + 2)
  // A soft pick: filtered noise, so it sounds plucked, not scratched.
  let last = 0
  for (let i = 0; i < line.length; i++) {
    last = last * 0.5 + (Math.random() * 2 - 1) * 0.5
    line[i] = last
  }
  let idx = 0
  for (let i = 0; i < data.length; i++) {
    const a = line[idx]
    const b = line[(idx + 1) % line.length]
    const v = a + (b - a) * frac
    data[i] = v
    line[idx] = damping * 0.5 * (a + b)
    idx = (idx + 1) % line.length
  }
  return out
}

function impulse(seconds = 2.4) {
  const rate = ctx.sampleRate
  const out = ctx.createBuffer(2, Math.floor(rate * seconds), rate)
  for (let c = 0; c < 2; c++) {
    const d = out.getChannelData(c)
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3)
  }
  return out
}

function setupCalm() {
  calmGain = ctx.createGain()
  calmGain.gain.value = 0
  // A gentle low-pass takes the edge off the plucks.
  const mellow = ctx.createBiquadFilter()
  mellow.type = 'lowpass'
  mellow.frequency.value = 2200
  calmGain.connect(mellow).connect(master)
  reverb = ctx.createConvolver()
  reverb.buffer = impulse()
  const wet = ctx.createGain()
  wet.gain.value = 0.55
  reverb.connect(wet).connect(calmGain)
  plucks = { melody: MELODY.map((f) => pluckBuffer(f)), roots: ROOTS.map((f) => pluckBuffer(f, 3.5, 0.998)) }
}

function pluck(buffer, t, gain, bend = 0) {
  const src = ctx.createBufferSource()
  src.buffer = buffer
  // Guzheng players press the string to bend a note up after plucking it.
  if (bend) {
    src.playbackRate.setValueAtTime(1, t)
    src.playbackRate.setValueAtTime(1, t + 0.18)
    src.playbackRate.linearRampToValueAtTime(Math.pow(2, bend / 12), t + 0.42)
  }
  const g = ctx.createGain()
  g.gain.setValueAtTime(gain, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + buffer.duration)
  src.connect(g)
  g.connect(calmGain)
  g.connect(reverb)
  src.start(t)
  src.stop(t + buffer.duration)
}

function pad(freqs, t, length) {
  for (const f of freqs) {
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.value = f
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(0.035, t + length * 0.4)
    g.gain.linearRampToValueAtTime(0.0001, t + length)
    o.connect(g)
    g.connect(calmGain)
    g.connect(reverb)
    o.start(t)
    o.stop(t + length + 0.05)
  }
}

function scheduleCalmBar(start, bar) {
  const chord = bar % 4
  pluck(plucks.roots[chord], start, 0.5)
  pad(DRONE[chord], start, 8 * EIGHTH + 0.6)
  // A wandering melody: small steps along the scale, with rests, a long
  // note at the end of each phrase, and now and then a bend or a tremolo.
  const phraseEnd = bar % 4 === 3
  for (let e = 0; e < 8; e++) {
    const t = start + e * EIGHTH + (Math.random() - 0.5) * 0.02
    if (calmMelody.rest > 0) {
      calmMelody.rest--
      continue
    }
    if (phraseEnd && e >= 4) break
    if (Math.random() < 0.38) continue
    const step = [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]
    calmMelody.note = Math.max(0, Math.min(MELODY.length - 1, calmMelody.note + step))
    const buf = plucks.melody[calmMelody.note]
    const roll = Math.random()
    if (roll < 0.08 && e < 6) {
      // Tremolo: the same string picked quickly, fading.
      for (let k = 0; k < 6; k++) pluck(buf, t + k * 0.07, 0.22 * (1 - k * 0.12))
      calmMelody.rest = 2
    } else {
      pluck(buf, t, 0.3 + Math.random() * 0.1, roll > 0.88 ? 2 : 0)
      if (Math.random() < 0.3) calmMelody.rest = 1 // let it ring
    }
  }
  if (phraseEnd) pluck(plucks.melody[[0, 3, 5][Math.floor(Math.random() * 3)]], start + 4 * EIGHTH, 0.34)
}

let musicStyle = 'calm'

function setupLoops() {
  setupCalm()
  let next = ctx.currentTime + 0.1
  let bar = 0
  musicTimer = setInterval(() => {
    while (next < ctx.currentTime + 0.4) {
      if (musicStyle === 'afro') scheduleBar(next, bar)
      if (musicStyle === 'calm') scheduleCalmBar(next, bar)
      next += musicStyle === 'calm' ? 8 * EIGHTH : 16 * STEP
      bar++
    }
  }, 100)

  // Siren: a wailing tone whose volume follows how close the police are.
  const so = ctx.createOscillator()
  so.type = 'sawtooth'
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 0.7
  const lfoGain = ctx.createGain()
  lfoGain.gain.value = 260
  lfo.connect(lfoGain).connect(so.frequency)
  so.frequency.value = 900
  const sf = ctx.createBiquadFilter()
  sf.type = 'lowpass'
  sf.frequency.value = 1800
  siren = ctx.createGain()
  siren.gain.value = 0
  so.connect(sf).connect(siren).connect(master)
  so.start()
  lfo.start()

  // Horn: two detuned square waves, the classic danfo "poh poh".
  horn = ctx.createGain()
  horn.gain.value = 0
  const hf = ctx.createBiquadFilter()
  hf.type = 'lowpass'
  hf.frequency.value = 1200
  ;[392, 494].forEach((f) => {
    const o = ctx.createOscillator()
    o.type = 'square'
    o.frequency.value = f
    o.connect(hf)
    o.start()
  })
  hf.connect(horn).connect(master)

  // Engine hum.
  const eo = ctx.createOscillator()
  eo.type = 'sawtooth'
  eo.frequency.value = 40
  const ef = ctx.createBiquadFilter()
  ef.type = 'lowpass'
  ef.frequency.value = 300
  engine = ctx.createGain()
  engine.gain.value = 0
  eo.connect(ef).connect(engine).connect(master)
  engine.osc = eo
  eo.start()
}

const smooth = (param, value) => ctx && param.setTargetAtTime(value, ctx.currentTime, 0.08)

// style: 'calm' (default), 'afro' (Afrobeats groove) or 'off'.
export const MUSIC_STYLES = ['calm', 'afro', 'off']
export const MUSIC_VOLUME = { calm: 0.35, afro: 0.2 } // raise or lower to taste
export function setMusic(style) {
  musicStyle = style
  // Background levels: quiet enough to sit under horns, engines and dialogue.
  if (musicGain) smooth(musicGain.gain, style === 'afro' ? MUSIC_VOLUME.afro : 0)
  if (calmGain) smooth(calmGain.gain, style === 'calm' ? MUSIC_VOLUME.calm : 0)
}
export function setSiren(volume) {
  if (siren) smooth(siren.gain, volume * 0.12)
}
export function setHorn(on) {
  if (horn) smooth(horn.gain, on ? 0.18 : 0)
}
export function setEngine(on, speed) {
  if (!engine) return
  smooth(engine.gain, on ? 0.05 + Math.min(speed, 40) * 0.001 : 0)
  smooth(engine.osc.frequency, 38 + Math.abs(speed) * 2.4)
}

export function blip() {
  if (ctx) tone('square', 700 + Math.random() * 200, ctx.currentTime, 0.04, 0.05)
}
export function thud() {
  if (ctx) hiss(ctx.currentTime, 0.25, 0.6, 'lowpass', 400)
}
export function jingle() {
  if (!ctx) return
  const t = ctx.currentTime
  ;[523.3, 659.3, 784, 1046.5].forEach((f, i) => tone('triangle', f, t + i * 0.11, 0.35, 0.25))
}
// Phone sounds: a short double chirp for a text, and a ring (call it again
// every couple of seconds while the phone rings).
export function textTone() {
  if (!ctx) return
  const t = ctx.currentTime
  tone('sine', 1318.5, t, 0.12, 0.18)
  tone('sine', 1760, t + 0.1, 0.18, 0.18)
}
export function ringTone() {
  if (!ctx) return
  const t = ctx.currentTime
  for (let k = 0; k < 2; k++) for (let n = 0; n < 8; n++) tone('sine', n % 2 ? 880 : 988, t + k * 0.5 + n * 0.05, 0.06, 0.14)
}

// A traffic warden's whistle: two sharp trills.
export function whistle() {
  if (!ctx) return
  const t = ctx.currentTime
  for (let k = 0; k < 2; k++) {
    for (let n = 0; n < 5; n++) tone('sine', n % 2 ? 2900 : 3150, t + k * 0.32 + n * 0.045, 0.05, 0.12)
  }
}
export function bust() {
  if (!ctx) return
  const t = ctx.currentTime
  ;[392, 311, 233].forEach((f, i) => tone('sawtooth', f, t + i * 0.18, 0.4, 0.15))
}

export function stopAudio() {
  clearInterval(musicTimer)
  ctx?.close()
  ctx = null
  voices = null
}

export function punchSound() {
  if (!ctx) return
  const t = ctx.currentTime
  hiss(t, 0.09, 0.5, 'lowpass', 900)
  tone('sine', 160, t, 0.12, 0.5, master, 60)
}
export function clang() {
  if (!ctx) return
  const t = ctx.currentTime
  tone('square', 880, t, 0.18, 0.08)
  tone('square', 1320, t, 0.12, 0.05)
  hiss(t, 0.06, 0.3, 'highpass', 3000)
}
export function crashSound(strength = 1) {
  if (!ctx) return
  const t = ctx.currentTime
  hiss(t, 0.35, Math.min(0.9, 0.3 + strength * 0.3), 'lowpass', 1200)
  tone('square', 220, t, 0.12, 0.06)
}
export function boom() {
  if (!ctx) return
  const t = ctx.currentTime
  hiss(t, 1.2, 0.9, 'lowpass', 500)
  tone('sine', 90, t, 0.9, 0.9, master, 30)
}
export function honk() {
  if (!horn) return
  setHorn(true)
  setTimeout(() => setHorn(false), 260)
}
export function swoosh() {
  if (ctx) hiss(ctx.currentTime, 0.08, 0.12, 'bandpass', 2400)
}
export function alarm() {
  if (!ctx) return
  const t = ctx.currentTime
  for (let i = 0; i < 8; i++) tone('square', i % 2 ? 960 : 720, t + i * 0.25, 0.22, 0.09)
}
export function splash() {
  if (ctx) hiss(ctx.currentTime, 0.8, 0.7, 'lowpass', 900)
}

// --- Traffic: engine voices for the nearest vehicles, and their horns ---
// A small pool of engine voices is handed to whichever vehicles are closest
// each frame, so the street sounds busy without hundreds of oscillators.
// Volume falls off with distance and the sound pans left or right of the camera.
export const ENGINE_VOICES = 4
const HEAR = 55 // metres
const ENGINE_SOUND = {
  // wave, idle Hz, Hz per m/s, filter Hz, loudness
  sedan: ['sawtooth', 34, 2.2, 380, 1],
  police: ['sawtooth', 38, 2.4, 420, 1],
  jeep: ['sawtooth', 28, 1.9, 340, 1.2],
  danfo: ['sawtooth', 24, 1.6, 300, 1.5], // a tired diesel
  keke: ['square', 62, 4.2, 900, 0.8], // two-stroke buzz
}
// Horn notes per vehicle type.
const HORNS = {
  sedan: [[415, 523], 0.24],
  police: [[311, 370], 0.3],
  jeep: [[330, 415], 0.3],
  danfo: [[392, 494], 0.2], // "poh poh"
  keke: [[740, 880], 0.14],
}
let voices = null

function makeVoice() {
  const o = ctx.createOscillator()
  const sub = ctx.createOscillator() // a second, lower oscillator gives the rumble
  const f = ctx.createBiquadFilter()
  f.type = 'lowpass'
  const g = ctx.createGain()
  g.gain.value = 0
  const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null
  o.connect(f)
  sub.connect(f)
  f.connect(g)
  if (pan) g.connect(pan).connect(master)
  else g.connect(master)
  o.start()
  sub.start()
  return { o, sub, f, g, pan, type: null }
}

const spatial = (x, z, listener) => {
  const dx = x - listener.x
  const dz = z - listener.z
  const d = Math.hypot(dx, dz)
  const fall = Math.max(0, 1 - d / HEAR)
  // Positive pan is to the camera's right.
  const pan = d > 0.1 ? Math.max(-1, Math.min(1, (dx * listener.rightX + dz * listener.rightZ) / d)) : 0
  return { d, gain: fall * fall, pan }
}

// sources: [{ x, z, speed, type }] already sorted nearest first.
// listener: { x, z, rightX, rightZ }; muted when indoors or in menus.
export function updateTrafficAudio(sources, listener, muted) {
  if (!ctx) return
  voices ??= Array.from({ length: ENGINE_VOICES }, makeVoice)
  voices.forEach((voice, i) => {
    const s = muted ? null : sources[i]
    if (!s) {
      smooth(voice.g.gain, 0)
      return
    }
    const [wave, idle, perSpeed, filter, loud] = ENGINE_SOUND[s.type] ?? ENGINE_SOUND.sedan
    if (voice.type !== s.type) {
      voice.type = s.type
      voice.o.type = wave
      voice.sub.type = 'triangle'
      voice.f.frequency.value = filter
    }
    const { gain, pan } = spatial(s.x, s.z, listener)
    const hz = idle + Math.abs(s.speed) * perSpeed
    smooth(voice.o.frequency, hz)
    smooth(voice.sub.frequency, hz / 2)
    smooth(voice.g.gain, gain * 0.045 * loud * (0.6 + Math.min(Math.abs(s.speed), 20) / 50))
    if (voice.pan) smooth(voice.pan.pan, pan)
  })
}

// A horn blast from a vehicle out in the world.
export function trafficHorn(type, x, z, listener, length = 0.3, beeps = 1) {
  if (!ctx) return
  const { gain, pan } = spatial(x, z, listener)
  if (gain < 0.01) return
  const [notes, loud] = HORNS[type] ?? HORNS.sedan
  const out = ctx.createGain()
  out.gain.value = 0
  const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null
  const f = ctx.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = 1400
  f.connect(out)
  if (p) {
    p.pan.value = pan
    out.connect(p).connect(master)
  } else out.connect(master)
  const t0 = ctx.currentTime + 0.01
  const peak = gain * loud
  let end = t0
  for (let b = 0; b < beeps; b++) {
    const t = t0 + b * (length + 0.12)
    out.gain.setValueAtTime(0, t)
    out.gain.linearRampToValueAtTime(peak, t + 0.015)
    out.gain.setValueAtTime(peak, t + length)
    out.gain.linearRampToValueAtTime(0, t + length + 0.03)
    end = t + length + 0.05
  }
  notes.forEach((hz) => {
    const o = ctx.createOscillator()
    o.type = 'square'
    o.frequency.value = hz * (0.98 + Math.random() * 0.04)
    o.connect(f)
    o.start(t0)
    o.stop(end)
  })
}
