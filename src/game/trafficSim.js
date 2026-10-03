import { CELL, city, halfFor, hasLight, hasStop, ISLAND, lanePoint, lineCount, mulberry32, nodeCount, nodeCoord, ROAD, roadX, roadZ, segmentValid } from './cityData'
import { lightFor } from './signals'
import { VEHICLES } from './vehicleTypes'

// Traffic simulation on the road grid. Vehicles follow lanes, pick a random
// way at each junction, stop at red lights and queue behind each other.
// Police cars patrol the same way until you're wanted, then they hunt you.

const MIX = ['danfo', 'danfo', 'danfo', 'keke', 'keke', 'sedan', 'sedan', 'sedan', 'jeep', 'jeep']
// The Island (Ikoyi, VI, Lekki) is where the money is: mostly big cars.
const LUX_MIX = ['benz', 'benz', 'benz', 'gwagon', 'gwagon', 'gwagon', 'sports', 'sports', 'jeep', 'danfo', 'keke']
const mixAt = (x) => (x > ISLAND.minX - 20 ? LUX_MIX : MIX)
const ISLAND_PARKED = { sedan: 'benz', jeep: 'gwagon' }
const TRAFFIC = 34
const POLICE = 6
const RECYCLE = 190
const STOP_BACK = 6 // how far before the junction box cars stop
export const TRAFFIC_HP = 60

const DWELL = 4 // seconds a danfo waits at a stop

// Bus stops, by the lane they sit on.
const stopsByLane = {}
city.busStops.forEach((s) => (stopsByLane[`${s.axis}:${s.line}:${s.dir}`] ??= []).push(s))

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
    hp: TRAFFIC_HP,
    riders: [], // passengers on board (crowd NPCs, hidden while riding)
    dwell: 0, // seconds left stopped at a bus stop
    stall: 0, // seconds stopped after a knock
    burning: 0,
    wrecked: false,
    ...extra,
  }
}

export function setLane(v, axis, line, dir, p) {
  v.state = 'lane'
  v.axis = axis
  v.line = line
  v.dir = dir
  v.p = p
  v.stoppedAt = null // stop sign already obeyed on this stretch
  // Next junction ahead along this road; turn around if the road ends.
  const f = (p + halfFor(axis)) / CELL
  v.node = dir > 0 ? Math.floor(f) + 1 : Math.ceil(f) - 1
  const ahead = dir > 0 ? v.node - 1 : v.node
  if (v.node < 0 || v.node > nodeCount(axis) || !segmentValid(axis, line, ahead)) {
    v.dir = -dir
    v.node = dir > 0 ? Math.floor(f) : Math.ceil(f)
  }
  const pt = lanePoint(axis, line, v.dir, p)
  v.x = pt.x
  v.z = pt.z
  v.yaw = Math.atan2(axis === 'x' ? v.dir : 0, axis === 'z' ? v.dir : 0)
}

// A random spot on a lane, at least `min` and at most `max` from `near`.
function randomLanePosition(near, min, max) {
  for (let tries = 0; tries < 40; tries++) {
    const axis = rand() < 0.5 ? 'x' : 'z'
    const line = Math.floor(rand() * (lineCount(axis) + 1))
    const dir = rand() < 0.5 ? 1 : -1
    const seg = Math.floor(rand() * nodeCount(axis))
    if (!segmentValid(axis, line, seg)) continue
    // Stay out of junction boxes.
    const p = nodeCoord(axis, seg) + ROAD / 2 + 3 + rand() * (CELL - ROAD - 6)
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
    const spot = randomLanePosition(near, 18, 170) ?? randomLanePosition(null, 0, 1e9)
    const v = makeVehicle(k < POLICE ? 'police' : pick(mixAt(lanePoint(spot.axis, spot.line, spot.dir, spot.p).x)))
    setLane(v, spot.axis, spot.line, spot.dir, spot.p)
    v.speed = VEHICLES[v.type].cruise * 0.6
    vehicles.push(v)
  }
  city.parkedCars.forEach((c) => {
    const type = c.x > ISLAND.minX ? (ISLAND_PARKED[c.type] ?? c.type) : c.type
    const v = makeVehicle(type, { state: 'parked', decor: true, x: c.x, z: c.z, yaw: c.yaw, ...(c.color && { color: c.color }) })
    vehicles.push(v)
  })
}

function junctionOptions(v) {
  // Junction indices (i along x, j along z).
  const I = v.axis === 'x' ? v.node : v.line
  const J = v.axis === 'x' ? v.line : v.node
  const options = []
  // Only roads that exist: no driving into the lagoon except over a bridge.
  if (v.axis === 'x') {
    if (segmentValid('x', J, v.dir > 0 ? I : I - 1)) options.push({ axis: 'x', line: J, dir: v.dir, straight: true })
    if (segmentValid('z', I, J)) options.push({ axis: 'z', line: I, dir: 1 })
    if (segmentValid('z', I, J - 1)) options.push({ axis: 'z', line: I, dir: -1 })
  } else {
    if (segmentValid('z', I, v.dir > 0 ? J : J - 1)) options.push({ axis: 'z', line: I, dir: v.dir, straight: true })
    if (segmentValid('x', J, I)) options.push({ axis: 'x', line: J, dir: 1 })
    if (segmentValid('x', J, I - 1)) options.push({ axis: 'x', line: J, dir: -1 })
  }
  // Dead end: turn around.
  if (!options.length) options.push({ axis: v.axis, line: v.line, dir: -v.dir, uturn: true })
  return { I, J, options }
}

function startTurn(v, target) {
  const { I, J, options } = junctionOptions(v)
  let choice
  if (target) {
    // Police: take whichever exit gets closer to the target.
    let best = Infinity
    options.forEach((o) => {
      const nx = roadX(o.axis === 'x' ? I + o.dir : I)
      const nz = roadZ(o.axis === 'z' ? J + o.dir : J)
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
  const nx = roadX(I)
  const nz = roadZ(J)
  const entryP = (v.axis === 'x' ? nx : nz) - v.dir * (ROAD / 2)
  const p0 = lanePoint(v.axis, v.line, v.dir, entryP)
  const exitP = (choice.axis === 'x' ? nx : nz) + choice.dir * (ROAD / 2)
  const p2 = lanePoint(choice.axis, choice.line, choice.dir, exitP)
  let p1
  if (choice.straight) p1 = { x: (p0.x + p2.x) / 2, z: (p0.z + p2.z) / 2 }
  else if (choice.uturn) p1 = { x: nx + (v.axis === 'x' ? v.dir * ROAD * 0.4 : 0), z: nz + (v.axis === 'z' ? v.dir * ROAD * 0.4 : 0) }
  else p1 = v.axis === 'x' ? { x: p2.x, z: p0.z } : { x: p0.x, z: p2.z }
  const chord = Math.hypot(p2.x - p0.x, p2.z - p0.z)
  const len = (Math.hypot(p1.x - p0.x, p1.z - p0.z) + Math.hypot(p2.x - p1.x, p2.z - p1.z) + chord) / 2
  v.state = 'turn'
  v.turn = { p0, p1, p2, len, t: 0, from: { axis: v.axis, line: v.line, dir: v.dir }, next: { ...choice, p: exitP } }
}

// Leave the road network and go straight at the target, or rejoin it at the
// nearest stretch of road that exists, preferring the way it's facing.
function snapToLane(v) {
  const sx = Math.sin(v.yaw)
  const sz = Math.cos(v.yaw)
  const facing = Math.abs(sx) > Math.abs(sz) ? 'x' : 'z'
  let best = null
  for (const axis of [facing, facing === 'x' ? 'z' : 'x']) {
    const cross = axis === 'x' ? v.z : v.x
    const along = axis === 'x' ? v.x : v.z
    const line = clamp(Math.round((cross + halfFor(axis === 'x' ? 'z' : 'x')) / CELL), 0, lineCount(axis))
    const seg = clamp(Math.floor((along + halfFor(axis)) / CELL), 0, nodeCount(axis) - 1)
    if (!segmentValid(axis, line, seg)) continue
    const dir = Math.sign(axis === 'x' ? sx : sz) || 1
    best = { axis, line, dir, p: along }
    break
  }
  const before = { x: v.x, z: v.z }
  if (best) setLane(v, best.axis, best.line, best.dir, best.p)
  else {
    const spot = randomLanePosition(v, 0, 120)
    if (spot) setLane(v, spot.axis, spot.line, spot.dir, spot.p)
  }
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
    v.type = pick(mixAt(lanePoint(spot.axis, spot.line, spot.dir, spot.p).x))
    v.color = pick(VEHICLES[v.type].colors)
    v.dirty = true
  }
  v.decor = false
  v.dropRiders = v.riders.length > 0 // let them off somewhere sensible
  v.dwell = 0
  v.hp = TRAFFIC_HP
  v.wrecked = false
  v.burning = 0
  v.stall = 0
  setLane(v, spot.axis, spot.line, spot.dir, spot.p)
  v.offX = v.offZ = 0
  v.speed = VEHICLES[v.type].cruise * 0.6
}

// ctx: { focus, playerCar: {x,z} | null (only while driving), pedestrian: {x,z} | null, wanted,
//        chase: {x,z} where the police last saw you, hidden: they can't see you now }
export function updateTraffic(dt, ctx) {
  const { focus, wanted } = ctx
  const chase = ctx.chase ?? focus
  const chasers = wanted > 0 ? Math.min(POLICE, wanted + 1) : 0
  // The closest police cars join the chase: closest to you while they can
  // see you, closest to where they last saw you while you're hidden (patrols
  // that never saw you don't magically know where you are).
  const police = vehicles.filter((v) => v.police && v.state !== 'parked')
  const near = ctx.hidden ? chase : focus
  police.sort((a, b) => Math.hypot(a.x - near.x, a.z - near.z) - Math.hypot(b.x - near.x, b.z - near.z))
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
    // Burning, or the officer is out on foot: the car stays where it is.
    if (v.burning > 0 || v.officerOut) {
      v.speed = Math.max(0, v.speed - 20 * dt)
      continue
    }
    v.stall = Math.max(0, v.stall - dt)
    const stalled = v.stall > 0

    // Chasing: head for where they last saw you. Once there with no sign of
    // you, cruise the nearby streets looking (random turns).
    let hunt = null
    if (v.chasing) {
      const toChase = Math.hypot(v.x - chase.x, v.z - chase.z)
      hunt = ctx.hidden && toChase < 14 ? null : chase
      v.hunt = hunt
      // Far behind while you're in view: a closer patrol car takes over.
      if (dist > 260 && !ctx.hidden) respawnNear(v, focus)
      if (v.state === 'lane' && hunt && toChase < 24) v.state = 'direct'
      if (v.state === 'direct') {
        if (!hunt || toChase > 45) {
          snapToLane(v)
        } else {
          const want = Math.atan2(chase.x - v.x, chase.z - v.z)
          v.yaw += clamp(wrap(want - v.yaw), -2.6 * dt, 2.6 * dt)
          const target = toChase < 6 || stalled ? 0 : Math.min(24, toChase * 1.4)
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

    const cruise = v.chasing ? (hunt ? 26 : 14) : def.cruise

    if (v.state === 'lane') {
      const entry = nodeCoord(v.axis, v.node) - v.dir * (ROAD / 2)
      const toEntry = (entry - v.p) * v.dir
      let desired = stalled ? 0 : cruise

      // Danfos and kekes pull up at bus stops with people waiting (or riders to drop).
      if (def.picksUp && !v.chasing) {
        if (v.dwell > 0) {
          v.dwell -= dt
          desired = 0
        } else {
          for (const stop of stopsByLane[`${v.axis}:${v.line}:${v.dir}`] ?? []) {
            const ahead = (stop.p - v.p) * v.dir
            if (ahead <= -1 || ahead > 30 || stop.id === v.lastStop) continue
            if (!(ctx.waiting?.[stop.id] > 0) && !v.riders.length) continue
            desired = Math.min(desired, Math.max(0, ahead - 0.3) * 1.2)
            if (ahead < 1.5 && v.speed < 0.6) {
              v.dwell = DWELL
              v.dwellStop = stop
              v.dwellNew = true
              v.lastStop = stop.id
            }
          }
        }
      }

      if (!v.chasing) {
        const I = v.axis === 'x' ? v.node : v.line
        const J = v.axis === 'x' ? v.line : v.node
        if (hasLight(I, J)) {
          const light = lightFor(v.axis)
          const mustStop = light === 'red' || (light === 'yellow' && toEntry > STOP_BACK + 4)
          if (mustStop && toEntry > STOP_BACK - 2) desired = Math.min(desired, Math.max(0, toEntry - STOP_BACK) * 1.2)
        } else if (hasStop(I, J) && v.stoppedAt !== v.node) {
          // Stop sign: come to a full stop at the line, wait a moment, go.
          if (toEntry > STOP_BACK - 2) desired = Math.min(desired, Math.max(0, toEntry - STOP_BACK) * 1.2)
          if (toEntry < STOP_BACK + 1.5 && v.speed < 0.6) {
            v.stopWait = (v.stopWait ?? 0) + dt
            if (v.stopWait > 0.9) {
              v.stoppedAt = v.node
              v.stopWait = 0
            }
          }
        }
        const beforeQueue = desired
        const gap = leaderGap(v)
        if (gap < Infinity) desired = Math.min(desired, Math.max(0, gap - 7.5) * 1.1)
        const queued = desired < beforeQueue - 2
        // Don't run over the player (on foot or driving).
        const width = def.half[0] + 1.3
        const beforePlayer = desired
        if (ctx.playerCar) desired = Math.min(desired, Math.max(0, obstacleGap(v, ctx.playerCar.x, ctx.playerCar.z, width) - 6.5) * 1.1)
        if (ctx.pedestrian) desired = Math.min(desired, Math.max(0, obstacleGap(v, ctx.pedestrian.x, ctx.pedestrian.z, width - 0.5) - 4) * 1.1)
        // How long this driver has been held up, and by whom: drivers lean on
        // the horn when you are in their way (Traffic.jsx plays it).
        v.blockedBy = desired < beforePlayer - 2 ? 'player' : queued && v.speed < 2 ? 'queue' : null
      } else {
        v.blockedBy = null
      }
      v.blockedFor = v.blockedBy ? (v.blockedFor ?? 0) + dt : 0

      v.speed += clamp(desired - v.speed, -16 * dt, def.accel * 0.4 * dt)
      v.p += v.dir * v.speed * dt
      const pt = lanePoint(v.axis, v.line, v.dir, v.p)
      v.x = pt.x
      v.z = pt.z
      if ((entry - v.p) * v.dir <= 0) startTurn(v, v.chasing ? v.hunt : null)
    } else if (v.state === 'turn') {
      const t = v.turn
      const turning = !t.next.straight
      const target = stalled ? 0 : turning ? Math.min(cruise, v.chasing ? 14 : 7) : cruise
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
  const taken = { type: v.type, color: v.color, x: v.x, z: v.z, yaw: v.yaw, speed: v.speed, police: v.police, hp: v.hp }
  v.type = playerCar.type
  v.color = playerCar.color
  v.hp = playerCar.hp ?? TRAFFIC_HP
  v.stall = 0
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
