import { city, GRID, hasLight, lanePoint, roadLine, ROAD, HALF, CELL, mulberry32 } from './cityData'
import { lightFor } from './signals'
import { VEHICLES } from './vehicleTypes'

// Traffic simulation on the road grid. Vehicles follow lanes, pick a random
// way at each junction, stop at red lights and queue behind each other.
// Police cars patrol the same way until you're wanted, then they hunt you.

const MIX = ['danfo', 'danfo', 'danfo', 'keke', 'keke', 'sedan', 'sedan', 'sedan', 'jeep', 'jeep']
const TRAFFIC = 34
const POLICE = 6
const RECYCLE = 190
const STOP_BACK = 6 // how far before the junction box cars stop

const rand = mulberry32(4242)
const pick = (list) => list[Math.floor(rand() * list.length)]
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a))

export const vehicles = []

function makeVehicle(type, extra = {}) {
  const def = VEHICLES[type]
  return {
    type,
    color: pick(def.colors),
    state: 'lane',
    speed: 0,
    x: 0,
    z: 0,
    yaw: 0,
    offX: 0, // visual offset that decays after a teleport/snap
    offZ: 0,
    spin: 0,
    police: type === 'police',
    chasing: false,
    ...extra,
  }
}

function setLane(v, axis, line, dir, p) {
  v.state = 'lane'
  v.axis = axis
  v.line = line
  v.dir = dir
  v.p = p
  // Next junction ahead along this road.
  const f = (p + HALF) / CELL
  v.node = dir > 0 ? Math.floor(f) + 1 : Math.ceil(f) - 1
  if (v.node < 0 || v.node > GRID) {
    v.dir = -dir
    v.node = dir > 0 ? GRID - 1 : 1
  }
  const pt = lanePoint(axis, line, v.dir, p)
  v.x = pt.x
  v.z = pt.z
  v.yaw = Math.atan2(axis === 'x' ? v.dir : 0, axis === 'z' ? v.dir : 0)
}

// A random spot on a lane, at least `min` and at most `max` from `near`.
function randomLanePosition(near, min, max) {
  for (let tries = 0; tries < 30; tries++) {
    const axis = rand() < 0.5 ? 'x' : 'z'
    const line = Math.floor(rand() * (GRID + 1))
    const dir = rand() < 0.5 ? 1 : -1
    // Stay out of junction boxes.
    const seg = Math.floor(rand() * GRID)
    const p = roadLine(seg) + ROAD / 2 + 3 + rand() * (CELL - ROAD - 6)
    const pt = lanePoint(axis, line, dir, p)
    const d = near ? Math.hypot(pt.x - near.x, pt.z - near.z) : 100
    if (d < min || d > max) continue
    const crowded = vehicles.some((o) => o.state !== 'parked' && Math.hypot(o.x - pt.x, o.z - pt.z) < 12)
    if (crowded) continue
    return { axis, line, dir, p }
  }
  return null
}

export function initTraffic(spawn) {
  const near = { x: spawn[0], z: spawn[2] }
  for (let k = 0; k < TRAFFIC + POLICE; k++) {
    const v = makeVehicle(k < POLICE ? 'police' : pick(MIX))
    const spot = randomLanePosition(near, 18, 170) ?? randomLanePosition(null, 0, 1e9)
    setLane(v, spot.axis, spot.line, spot.dir, spot.p)
    v.speed = VEHICLES[v.type].cruise * 0.6
    vehicles.push(v)
  }
  city.parkedCars.forEach((c) => {
    const v = makeVehicle(c.type, { state: 'parked', decor: true, x: c.x, z: c.z, yaw: c.yaw })
    vehicles.push(v)
  })
}

function junctionOptions(v) {
  // Junction indices (i along x, j along z).
  const I = v.axis === 'x' ? v.node : v.line
  const J = v.axis === 'x' ? v.line : v.node
  const options = []
  const inRange = (k) => k >= 0 && k <= GRID
  if (v.axis === 'x') {
    if (inRange(I + v.dir)) options.push({ axis: 'x', line: J, dir: v.dir, straight: true })
    if (inRange(J + 1)) options.push({ axis: 'z', line: I, dir: 1 })
    if (inRange(J - 1)) options.push({ axis: 'z', line: I, dir: -1 })
  } else {
    if (inRange(J + v.dir)) options.push({ axis: 'z', line: I, dir: v.dir, straight: true })
    if (inRange(I + 1)) options.push({ axis: 'x', line: J, dir: 1 })
    if (inRange(I - 1)) options.push({ axis: 'x', line: J, dir: -1 })
  }
  return { I, J, options }
}

function startTurn(v, target) {
  const { I, J, options } = junctionOptions(v)
  let choice
  if (target) {
    // Police: take whichever exit gets closer to the target.
    let best = Infinity
    options.forEach((o) => {
      const nx = roadLine(o.axis === 'x' ? I + o.dir : I)
      const nz = roadLine(o.axis === 'z' ? J + o.dir : J)
      const d = Math.hypot(nx - target.x, nz - target.z)
      if (d < best) {
        best = d
        choice = o
      }
    })
  } else {
    const weighted = options.flatMap((o) => (o.straight ? [o, o] : [o]))
    choice = weighted[Math.floor(Math.random() * weighted.length)]
  }
  const nx = roadLine(I)
  const nz = roadLine(J)
  const entryP = (v.axis === 'x' ? nx : nz) - v.dir * (ROAD / 2)
  const p0 = lanePoint(v.axis, v.line, v.dir, entryP)
  const exitP = (choice.axis === 'x' ? nx : nz) + choice.dir * (ROAD / 2)
  const p2 = lanePoint(choice.axis, choice.line, choice.dir, exitP)
  const p1 = choice.straight ? { x: (p0.x + p2.x) / 2, z: (p0.z + p2.z) / 2 } : v.axis === 'x' ? { x: p2.x, z: p0.z } : { x: p0.x, z: p2.z }
  const chord = Math.hypot(p2.x - p0.x, p2.z - p0.z)
  const len = (Math.hypot(p1.x - p0.x, p1.z - p0.z) + Math.hypot(p2.x - p1.x, p2.z - p1.z) + chord) / 2
  v.state = 'turn'
  v.turn = { p0, p1, p2, len, t: 0, from: { axis: v.axis, line: v.line, dir: v.dir }, next: { ...choice, p: exitP } }
}

// Leave the road network and go straight at the target, or rejoin it.
function snapToLane(v) {
  const sx = Math.sin(v.yaw)
  const sz = Math.cos(v.yaw)
  const axis = Math.abs(sx) > Math.abs(sz) ? 'x' : 'z'
  const dir = Math.sign(axis === 'x' ? sx : sz) || 1
  const cross = axis === 'x' ? v.z : v.x
  const line = clamp(Math.round((cross + HALF) / CELL), 0, GRID)
  const before = { x: v.x, z: v.z }
  setLane(v, axis, line, dir, axis === 'x' ? v.x : v.z)
  v.offX += before.x - v.x
  v.offZ += before.z - v.z
}

function leaderGap(v) {
  let gap = Infinity
  for (const o of vehicles) {
    if (o === v) continue
    if (o.state === 'lane' && o.axis === v.axis && o.line === v.line && o.dir === v.dir) {
      const ahead = (o.p - v.p) * v.dir
      if (ahead > 0 && ahead < gap) gap = ahead
    } else if (o.state === 'turn') {
      // Still clearing the junction we're heading into.
      const f = o.turn.from
      if (f.axis === v.axis && f.line === v.line && f.dir === v.dir) gap = Math.min(gap, Math.hypot(o.x - v.x, o.z - v.z))
    }
  }
  return gap
}

// How far ahead an obstacle point sits in this vehicle's lane, or Infinity.
function obstacleGap(v, x, z, width) {
  const ux = v.axis === 'x' ? v.dir : 0
  const uz = v.axis === 'z' ? v.dir : 0
  const rx = x - v.x
  const rz = z - v.z
  const ahead = rx * ux + rz * uz
  const side = Math.abs(rx * uz - rz * ux)
  return ahead > 0 && ahead < 30 && side < width ? ahead : Infinity
}

function respawnNear(v, focus) {
  const spot = randomLanePosition(focus, 90, 170)
  if (!spot) return
  if (!v.police && vehicles.filter((o) => o.police).length < POLICE) {
    v.police = true
    v.type = 'police'
    v.color = VEHICLES.police.colors[0]
    v.dirty = true
  } else if (!v.police) {
    v.type = pick(MIX)
    v.color = pick(VEHICLES[v.type].colors)
    v.dirty = true
  }
  v.decor = false
  setLane(v, spot.axis, spot.line, spot.dir, spot.p)
  v.offX = v.offZ = 0
  v.speed = VEHICLES[v.type].cruise * 0.6
}

// ctx: { focus, playerCar: {x,z} | null (only while driving), pedestrian: {x,z} | null, wanted }
export function updateTraffic(dt, ctx) {
  const { focus, wanted } = ctx
  const chasers = wanted > 0 ? Math.min(POLICE, wanted + 1) : 0
  // The closest police cars join the chase.
  const police = vehicles.filter((v) => v.police && v.state !== 'parked')
  police.sort((a, b) => Math.hypot(a.x - focus.x, a.z - focus.z) - Math.hypot(b.x - focus.x, b.z - focus.z))
  police.forEach((v, k) => {
    const chase = k < chasers
    if (v.chasing && !chase && v.state === 'direct') snapToLane(v)
    v.chasing = chase
  })

  for (const v of vehicles) {
    const def = VEHICLES[v.type]
    const decay = Math.exp(-2 * dt)
    v.offX *= decay
    v.offZ *= decay
    const dist = Math.hypot(v.x - focus.x, v.z - focus.z)

    if (v.state === 'parked') {
      v.speed = 0
      if (!v.decor && dist > 230) respawnNear(v, focus)
      continue
    }

    if (v.chasing) {
      if (dist > 260) respawnNear(v, focus)
      if (v.state === 'lane' && dist < 24) v.state = 'direct'
      if (v.state === 'direct') {
        if (dist > 45) {
          snapToLane(v)
        } else {
          const want = Math.atan2(focus.x - v.x, focus.z - v.z)
          v.yaw += clamp(wrap(want - v.yaw), -2.6 * dt, 2.6 * dt)
          const target = dist < 6 ? 0 : Math.min(24, dist * 1.4)
          v.speed += clamp(target - v.speed, -20 * dt, 10 * dt)
          v.x += Math.sin(v.yaw) * v.speed * dt
          v.z += Math.cos(v.yaw) * v.speed * dt
          v.spin += (v.speed * dt) / def.wheels.r
          continue
        }
      }
    } else if (dist > RECYCLE) {
      respawnNear(v, focus)
    }

    const cruise = v.chasing ? 26 : def.cruise

    if (v.state === 'lane') {
      const nodeCoord = roadLine(v.node)
      const entry = nodeCoord - v.dir * (ROAD / 2)
      const toEntry = (entry - v.p) * v.dir
      let desired = cruise

      if (!v.chasing) {
        const I = v.axis === 'x' ? v.node : v.line
        const J = v.axis === 'x' ? v.line : v.node
        if (hasLight(I, J)) {
          const light = lightFor(v.axis)
          const mustStop = light === 'red' || (light === 'yellow' && toEntry > STOP_BACK + 4)
          if (mustStop && toEntry > STOP_BACK - 2) desired = Math.min(desired, Math.max(0, toEntry - STOP_BACK) * 1.2)
        }
        const gap = leaderGap(v)
        if (gap < Infinity) desired = Math.min(desired, Math.max(0, gap - 7.5) * 1.1)
        // Don't run over the player (on foot or driving).
        const width = def.half[0] + 1.3
        if (ctx.playerCar) desired = Math.min(desired, Math.max(0, obstacleGap(v, ctx.playerCar.x, ctx.playerCar.z, width) - 6.5) * 1.1)
        if (ctx.pedestrian) desired = Math.min(desired, Math.max(0, obstacleGap(v, ctx.pedestrian.x, ctx.pedestrian.z, width - 0.5) - 4) * 1.1)
      }

      v.speed += clamp(desired - v.speed, -16 * dt, def.accel * 0.4 * dt)
      v.p += v.dir * v.speed * dt
      const pt = lanePoint(v.axis, v.line, v.dir, v.p)
      v.x = pt.x
      v.z = pt.z
      if ((entry - v.p) * v.dir <= 0) startTurn(v, v.chasing ? focus : null)
    } else if (v.state === 'turn') {
      const t = v.turn
      const turning = !t.next.straight
      const target = turning ? Math.min(cruise, v.chasing ? 14 : 7) : cruise
      v.speed += clamp(target - v.speed, -10 * dt, def.accel * 0.4 * dt)
      t.t = Math.min(1, t.t + (v.speed * dt) / t.len)
      const a = 1 - t.t
      const b = t.t
      v.x = a * a * t.p0.x + 2 * a * b * t.p1.x + b * b * t.p2.x
      v.z = a * a * t.p0.z + 2 * a * b * t.p1.z + b * b * t.p2.z
      const dx = 2 * a * (t.p1.x - t.p0.x) + 2 * b * (t.p2.x - t.p1.x)
      const dz = 2 * a * (t.p1.z - t.p0.z) + 2 * b * (t.p2.z - t.p1.z)
      if (dx || dz) v.yaw = Math.atan2(dx, dz)
      if (t.t >= 1) setLane(v, t.next.axis, t.next.line, t.next.dir, t.next.p)
    }
    v.spin += (v.speed * dt) / def.wheels.r
  }
}

// Swap the player's car with a traffic vehicle (carjacking). The old player
// car is left parked where it was, as a regular parked vehicle.
export function swapWithPlayerCar(v, playerCar) {
  const taken = { type: v.type, color: v.color, x: v.x, z: v.z, yaw: v.yaw, speed: v.speed, police: v.police }
  v.type = playerCar.type
  v.color = playerCar.color
  v.x = playerCar.x
  v.z = playerCar.z
  v.yaw = playerCar.yaw
  v.offX = v.offZ = 0
  v.state = 'parked'
  v.police = false
  v.chasing = false
  v.decor = false
  v.dirty = true
  return taken
}
