// Rain. Showers come and go on the real clock (so friends online get wet
// together), but only once you've been playing a while: the first ten
// minutes of a save are always dry. `rain` eases between 0 and 1.

const CYCLE = 15 * 60 * 1000 // a shower window every quarter hour...
const SHOWER = 4 * 60 * 1000 // ...lasting about four minutes, most of the time
const DRY_START = 10 * 60 // seconds of play before the first rain

export const weather = { rain: 0, target: 0, forced: null, flash: 0, nextThunder: 0 }

const hash = (n) => {
  let h = n * 2654435761
  h = (h ^ (h >>> 15)) * 2246822519
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296
}

export function rainTarget(now, playSeconds) {
  if (playSeconds < DRY_START) return 0
  const bucket = Math.floor(now / CYCLE)
  const h = hash(bucket)
  if (h < 0.3) return 0 // a dry quarter hour
  const into = now % CYCLE
  const start = CYCLE * 0.4
  if (into < start || into > start + SHOWER) return 0
  return h > 0.75 ? 1 : 0.6 // a downpour, or steady rain
}

// Returns true the moment a shower starts.
export function updateWeather(dt, playSeconds) {
  const was = weather.target
  weather.target = weather.forced ?? rainTarget(Date.now(), playSeconds)
  // Rain comes in over half a minute and clears a bit slower.
  const rate = weather.target > weather.rain ? 1 / 30 : 1 / 45
  weather.rain += Math.max(-rate * dt, Math.min(rate * dt, weather.target - weather.rain))
  weather.flash = Math.max(0, weather.flash - dt * 3)
  return was === 0 && weather.target > 0
}
