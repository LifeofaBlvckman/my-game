import { LANE, roadX, roadZ } from './cityData'
import { npcs } from './crowd'

// Mission set pieces: a car to chase down (Skido running with the money) and
// a fist fight with a few named-for-the-job toughs. GameLogic starts them from
// a quest step and asks every frame whether they're done.

// --- The chase ---
// The car drives a fixed route through the streets, in the right-hand lane.
// It waits at the start until you come near, then runs. Stay close (in a car)
// long enough and you run it off the road; let it reach the end of the route,
// or fall far behind, and it gets away (back to the start, try again).

const CATCH_TIME = 3.5 // seconds within CATCH_RANGE to force it off the road
const CATCH_RANGE = 9
const WAKE_RANGE = 90
const LOST_RANGE = 170

export const fugitive = { active: false, x: 0, z: 0, yaw: 0, close: 0, crashed: false, running: false }

function buildRoute(junctions) {
  const pts = junctions.map(([i, j]) => ({ x: roadX(i), z: roadZ(j) }))
  // Shift every leg into its right-hand lane.
  const legs = []
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k]
    const b = pts[k + 1]
    const len = Math.hypot(b.x - a.x, b.z - a.z)
    const dx = (b.x - a.x) / len
    const dz = (b.z - a.z) / len
    const ox = -dz * LANE
    const oz = dx * LANE
    legs.push({ ax: a.x + ox, az: a.z + oz, dx, dz, len, yaw: Math.atan2(dx, dz) })
  }
  return legs
}

export function startChase(def) {
  Object.assign(fugitive, {
    active: true,
    def,
    legs: buildRoute(def.route),
    leg: 0,
    along: 4,
    close: 0,
    crashed: false,
    running: false,
    lostFor: 0,
    type: def.type ?? 'jeep',
    color: def.color ?? '#111111',
  })
  place()
}

export function endChase() {
  fugitive.active = false
}

function place() {
  const l = fugitive.legs[fugitive.leg]
  fugitive.x = l.ax + l.dx * fugitive.along
  fugitive.z = l.az + l.dz * fugitive.along
}

// Returns 'caught', 'escaped' or null. `inCar`: only a car can run it off
// the road.
export function updateChase(dt, focus, inCar) {
  const f = fugitive
  if (!f.active || f.crashed) return null
  const d = Math.hypot(f.x - focus.x, f.z - focus.z)
  if (!f.running) {
    if (d < WAKE_RANGE) f.running = true
    return null
  }
  // Drive: slower into the corners.
  const l = f.legs[f.leg]
  const toCorner = l.len - f.along
  const speed = (f.def.speed ?? 13) * (0.5 + 0.5 * Math.min(1, toCorner / 14)) * (d < 25 ? 1.08 : 1)
  f.along += speed * dt
  if (f.along >= l.len) {
    if (f.leg >= f.legs.length - 1) return escape()
    f.along -= l.len
    f.leg += 1
  }
  place()
  const want = f.legs[f.leg].yaw
  f.yaw += Math.atan2(Math.sin(want - f.yaw), Math.cos(want - f.yaw)) * Math.min(1, dt * 6)
  f.speed = speed

  // Hunting it down.
  if (inCar && d < CATCH_RANGE) f.close += dt * (d < 4.5 ? 2 : 1)
  else f.close = Math.max(0, f.close - dt * 0.25)
  if (f.close >= CATCH_TIME) {
    f.crashed = true
    f.speed = 0
    return 'caught'
  }
  f.lostFor = d > LOST_RANGE ? f.lostFor + dt : 0
  if (f.lostFor > 20) return escape()
  return null
}

function escape() {
  startChase(fugitive.def)
  return 'escaped'
}

export const chaseProgress = () => Math.min(1, fugitive.close / CATCH_TIME)

// --- The fight ---
// Up to four toughs appear at a spot (`boss`: the first one is Skido, and
// flooring him ends it; otherwise every one of them must be floored once).

const brawlers = npcs.filter((n) => n.brawler)
export const brawl = { active: false, boss: false, at: null }

export function startBrawl(def, at) {
  brawl.active = true
  brawl.boss = !!def.boss
  brawl.at = at
  const crew = brawl.boss ? brawlers.slice(0, 1 + (def.goons ?? 0)) : brawlers.slice(1, 1 + (def.goons ?? 3))
  brawlers.forEach((n) => (n.active = false))
  crew.forEach((n, k) => {
    const a = (k / crew.length) * Math.PI * 2
    Object.assign(n, {
      active: true,
      kind: 'idle',
      x: at.x + Math.sin(a) * 1.6,
      z: at.z + Math.cos(a) * 1.6,
      y: def.y ?? 0.12,
      yaw: a + Math.PI,
      down: 0,
      fight: 0,
      panic: 0,
      beaten: false,
      leaving: false,
      demanding: true,
      hp: n === brawlers[0] ? 5 : 3,
    })
    n.home = { x: n.x, z: n.z, yaw: n.yaw }
  })
}

// Returns 'won' once the fight is over.
export function updateBrawl(focus, onFoot) {
  if (!brawl.active) {
    // Once it's over the fighters run off and vanish when out of sight.
    for (const n of brawlers) {
      if (n.active && n.leaving && n.down <= 0 && (Math.hypot(n.x - focus.x, n.z - focus.z) > 30 || performance.now() > n.leaveAt)) n.active = false
    }
    return null
  }
  const crew = brawlers.filter((n) => n.active)
  for (const n of crew) {
    if (n.down > 0) n.beaten = true
    const near = Math.hypot(n.x - focus.x, n.z - focus.z) < 26
    // Still standing and not yet beaten: keep coming at you.
    if (!n.beaten && n.down <= 0 && near && onFoot) {
      n.demanding = false
      n.fight = Math.max(n.fight, 3)
    }
    if (n.beaten && n.down <= 0) {
      n.fight = 0
      n.panic = 10
    }
  }
  const won = brawl.boss ? crew[0]?.beaten : crew.length && crew.every((n) => n.beaten)
  if (!won) return null
  brawl.active = false
  for (const n of crew) {
    // Off they go, away from you.
    const away = Math.atan2(n.x - focus.x, n.z - focus.z)
    n.fight = 0
    n.leaving = true
    n.leaveAt = performance.now() + 15000
    n.afterDown = 'panic'
    n.home = { x: n.x + Math.sin(away) * 60, z: n.z + Math.cos(away) * 60, yaw: away }
  }
  return 'won'
}

export function brawlTarget() {
  const crew = brawlers.filter((n) => n.active && !n.beaten)
  const n = brawl.boss ? brawlers[0] : crew[0]
  return n?.active ? { x: n.x, z: n.z } : brawl.at
}

export function endBrawl() {
  brawl.active = false
  brawlers.forEach((n) => (n.active = false))
}
