import { city } from './cityData'
import { useGame, world } from './state'

// Flights between the Mainland airport (Murtala Muhammed, at Ikeja) and the
// Island's airstrip at Eko Atlantic. Buy a ticket at the EKO AIR desk in the
// terminal: you board, the plane rolls down the runway, takes off, flies you
// over the city and lands at the other end (press E to skip ahead), and you
// come out at the arrivals door.

export const FARE = 2500
export const AIRPORTS = {
  mma: { name: 'IKEJA (MMA)', welcome: 'WELCOME TO LAGOS\nMURTALA MUHAMMED AIRPORT', get: () => city.airport, terminal: 'terminal' },
  eko: { name: 'EKO ATLANTIC', welcome: 'WELCOME TO\nEKO ATLANTIC', get: () => city.ekoAirport, terminal: 'ekoterminal' },
}

const CRUISE = 130 // m up
const lerp = (a, b, k) => a + (b - a) * k
const smooth = (k) => k * k * (3 - 2 * k)

// The whole trip as a list of timed legs, each a function of 0..1 -> [x, y, z].
function buildPath(from, to) {
  const A = from.get()
  const B = to.get()
  const d1 = A.takeoff
  const d2 = B.land
  const z1 = A.runway.z
  const z2 = B.runway.z
  const start = d1 > 0 ? A.runway.x0 + 8 : A.runway.x1 - 8
  const touch = d2 > 0 ? B.runway.x0 + 8 : B.runway.x1 - 8
  const room = B.runway.x1 - B.runway.x0 - 24
  const legs = []
  // Take-off roll: 90 m of runway, speeding up.
  const roll = 90
  legs.push({ dur: 6, at: (k) => [start + d1 * roll * k * k, 0, z1] })
  // Rotate and climb out straight ahead.
  const climbLen = 360
  const c0 = start + d1 * roll
  legs.push({ dur: 8, at: (k) => [c0 + d1 * climbLen * (0.42 * k + 0.58 * k * k), CRUISE * smooth(k) * 0.85, z1] })
  // Cruise: a smooth curve round to line up with the other runway, far out.
  const p0 = [c0 + d1 * climbLen, CRUISE * 0.85, z1]
  const approach = 700
  const p3 = [touch - d2 * approach, CRUISE, z2]
  const L = 520
  const p1 = [p0[0] + d1 * L, CRUISE, z1]
  const p2 = [p3[0] - d2 * L, CRUISE, z2]
  const bez = (k) => {
    const a = 1 - k
    return [0, 1, 2].map((i) => a * a * a * p0[i] + 3 * a * a * k * p1[i] + 3 * a * k * k * p2[i] + k * k * k * p3[i])
  }
  let len = 0
  for (let i = 0, prev = bez(0); i < 40; i++) {
    const next = bez((i + 1) / 40)
    len += Math.hypot(next[0] - prev[0], next[1] - prev[1], next[2] - prev[2])
    prev = next
  }
  legs.push({ dur: len / 70, at: bez })
  // The approach: a long straight glide down onto the runway.
  legs.push({ dur: approach / 55, at: (k) => [lerp(p3[0], touch, k), CRUISE * (1 - k) * (1 - k * 0.15), z2] })
  // Touch down and brake to a stop.
  const stop = Math.min(160, room)
  legs.push({ dur: 6, at: (k) => [touch + d2 * stop * (2 * k - k * k), 0, z2] })
  let t = 0
  for (const leg of legs) {
    leg.t0 = t
    t += leg.dur
  }
  return { legs, duration: t }
}

function pointAt(path, t) {
  const leg = path.legs.find((l) => t < l.t0 + l.dur) ?? path.legs.at(-1)
  const k = Math.min(1, Math.max(0, (t - leg.t0) / leg.dur))
  return leg.at(k)
}

// Where the plane is at time t, and which way it's pointing.
export function flightPose(f, t) {
  const p = pointAt(f.path, t)
  const q = pointAt(f.path, Math.min(f.path.duration, t + 0.25))
  const dx = q[0] - p[0]
  const dy = q[1] - p[1]
  const dz = q[2] - p[2]
  const flat = Math.hypot(dx, dz)
  const yaw = flat > 0.01 ? Math.atan2(dx, dz) : (f.pose?.yaw ?? 0)
  const pitch = flat > 0.01 ? Math.atan2(dy, flat) : 0
  // Bank into the turns.
  const prevYaw = f.pose?.yaw ?? yaw
  const turn = Math.atan2(Math.sin(yaw - prevYaw), Math.cos(yaw - prevYaw))
  const roll = (f.pose?.roll ?? 0) * 0.9 + Math.max(-0.5, Math.min(0.5, -turn * 30)) * 0.1
  return { x: p[0], y: p[1], z: p[2], yaw, pitch, roll, speed: flat / 0.25 }
}

// Hooks into the rest of the game (GameLogic sets these).
const hooks = { leaveTerminal: () => {}, arrive: () => {}, message: () => {} }
export const setFlightHooks = (h) => Object.assign(hooks, h)

// At the EKO AIR desk: buy a seat and go.
export function bookFlight(fromId) {
  const from = AIRPORTS[fromId]
  const toId = fromId === 'mma' ? 'eko' : 'mma'
  const to = AIRPORTS[toId]
  if (!from?.get() || !to?.get()) return false
  const game = useGame.getState()
  if (game.money < FARE) {
    hooks.message(`A TICKET IS ₦${FARE.toLocaleString()}`, '#ff6b6b')
    return false
  }
  useGame.setState({ money: game.money - FARE })
  const path = buildPath(from, to)
  world.flight = { from: fromId, to: toId, path, t: 0, pose: null, skip: false }
  world.flight.pose = flightPose(world.flight, 0)
  hooks.leaveTerminal(to)
  useGame.setState({ flight: { to: to.name } })
  return true
}

// Every frame while flying.
export function updateFlight(dt) {
  const f = world.flight
  if (!f) return
  f.t = f.skip ? Math.max(f.t, f.path.duration - 4) + dt : f.t + dt
  f.skip = false
  f.pose = flightPose(f, Math.min(f.t, f.path.duration))
  // The city around the plane comes to life (traffic, people), not round the
  // seat you'll come out at.
  world.simFocus = { x: f.pose.x, z: f.pose.z }
  if (f.t >= f.path.duration + 0.6) {
    const to = AIRPORTS[f.to]
    world.flight = null
    world.simFocus = null
    useGame.setState({ flight: null })
    hooks.arrive(to)
  }
}

export const skipFlight = () => world.flight && world.flight.t > 2 && (world.flight.skip = true)
