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
  musicGain.gain.value = 0.32
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

function setupLoops() {
  let next = ctx.currentTime + 0.1
  let bar = 0
  musicTimer = setInterval(() => {
    while (next < ctx.currentTime + 0.4) {
      if (musicGain.gain.value > 0.001) scheduleBar(next, bar)
      next += 16 * STEP
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

export function setMusic(on) {
  if (musicGain) smooth(musicGain.gain, on ? 0.32 : 0)
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
export function bust() {
  if (!ctx) return
  const t = ctx.currentTime
  ;[392, 311, 233].forEach((f, i) => tone('sawtooth', f, t + i * 0.18, 0.4, 0.15))
}

export function stopAudio() {
  clearInterval(musicTimer)
  ctx?.close()
  ctx = null
}
