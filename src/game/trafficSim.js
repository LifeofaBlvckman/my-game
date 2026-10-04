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
let nextId = 0

function makeVehicle(type, extra = {}) {
  const def = VEHICLES[type]
  return {
    id: nextId++,
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
    side: 0, // sideways shift in the lane: + pulled over to the curb, - pulling out to pass
    ...extra,
  }
}

// The lane's right-hand side (towards the curb).
const laneRight = (axis, dir) => (axis === 'x' ? { x: 0, z: dir } : { x: -dir, z: 0 })

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
  // Pulled over or passing: ease back to the lane line through the turn.
  v.offX += v.x - p0.x
  v.offZ += v.z - p0.z
  v.side = 0
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

// --- Not driving through each other ---
// Every moving vehicle looks down a corridor as wide as itself, straight
// ahead along its heading, and slows for whatever is in it: the car in front,
// someone crossing the junction, a parked or wrecked car, a police car.

// How wide and long `o` looks from a vehicle heading `yaw`.
function extentFrom(o, yaw) {
  const h = VEHICLES[o.type].half
  const rel = o.yaw - yaw
  const c = Math.abs(Math.cos(rel))
  const s = Math.abs(Math.sin(rel))
  return { lat: h[0] * c + h[2] * s, lon: h[2] * c + h[0] * s }
}

// Bumper-to-bumper distance to `o` if it's in v's corridor (within `range`).
function gapTo(v, o, range, margin) {
  const dx = o.x - v.x
  const dz = o.z - v.z
  if (Math.abs(dx) > range + 8 || Math.abs(dz) > range + 8) return Infinity
  const s = Math.sin(v.yaw)
  const c = Math.cos(v.yaw)
  const ahead = dx * s + dz * c
  if (ahead <= 0) return Infinity
  const hv = VEHICLES[v.type].half
  const e = extentFrom(o, v.yaw)
  if (Math.abs(dx * c - dz * s) > hv[0] + e.lat + margin) return Infinity
  const gap = ahead - hv[2] - e.lon
  return gap < range ? gap : Infinity
}

// Same, for a vehicle part way round a turn: walk along the curve it will
// actually drive (not straight on along its heading) and see what's there.
function pathGap(v, o, range) {
  const t = v.turn
  if (Math.abs(o.x - v.x) > range + 8 || Math.abs(o.z - v.z) > range + 8) return Infinity
  const hv = VEHICLES[v.type].half
  const step = 1.2
  for (let k = 1; k * step <= range; k++) {
    const u = Math.min(1, t.t + (k * step) / t.len)
    const a = 1 - u
    const px = a * a * t.p0.x + 2 * a * u * t.p1.x + u * u * t.p2.x
    const pz = a * a * t.p0.z + 2 * a * u * t.p1.z + u * u * t.p2.z
    const dx = 2 * a * (t.p1.x - t.p0.x) + 2 * u * (t.p2.x - t.p1.x)
    const dz = 2 * a * (t.p1.z - t.p0.z) + 2 * u * (t.p2.z - t.p1.z)
    const yaw = dx || dz ? Math.atan2(dx, dz) : v.yaw
    const e = extentFrom(o, yaw)
    const rx = o.x - px
    const rz = o.z - pz
    const s = Math.sin(yaw)
    const c = Math.cos(yaw)
    if (Math.abs(rx * c - rz * s) < hv[0] + e.lat + 0.15 && Math.abs(rx * s + rz * c) < hv[2] + e.lon + 0.15) return Math.max(0, (k - 1) * step)
    if (u >= 1) break
  }
  // Past the end of the curve: straight on along the new lane.
  return u1(v) ? gapTo(v, o, range, 0.3) : Infinity
}
const u1 = (v) => v.turn.t > 0.85

// The right check for a vehicle's state.
const gapFor = (v, o, range, margin) => (v.state === 'turn' ? pathGap(v, o, range) : gapTo(v, o, range, margin))

// Two vehicles nosing into each other: who goes first.
function hasPriority(v, o) {
  if (!!(v.chasing || v.lastmaOn) !== !!(o.chasing || o.lastmaOn)) return !!(v.chasing || v.lastmaOn) // sirens first
  if ((v.side ?? 0) < -0.5 !== (o.side ?? 0) < -0.5) return (o.side ?? 0) < -0.5 // the one pulling out to pass waits
  const vTurn = v.state === 'turn' && !v.turn.next.straight
  const oTurn = o.state === 'turn' && !o.turn.next.straight
  if (vTurn !== oTurn) return !vTurn // going straight beats turning
  return v.id < o.id
}

const stationary = (o) => o.state === 'parked' || o.wrecked || o.burning > 0 || o.officerOut

// Nearest thing in v's corridor: { gap, who }.
function blockedAhead(v, range, skip) {
  let gap = Infinity
  let who = null
  const nudging = v.nudgeFor > 0
  for (const o of vehicles) {
    if (o === v || (skip && skip(o))) continue
    const still = stationary(o)
    if (nudging && !still) continue
    const g = gapFor(v, o, range, still ? -0.15 : 0.3)
    if (g >= gap) continue
    // Mutual: both see each other (crossing paths). One of them carries on.
    if (!still && g < 9 && gapFor(o, v, range, 0.3) < Infinity && hasPriority(v, o)) continue
    gap = g
    who = o
  }
  return { gap, who }
}

// Someone already crossing this junction box from another direction.
function boxBusy(v, nx, nz) {
  const reach = ROAD / 2 + 1.5
  for (const o of vehicles) {
    if (o === v || o.state === 'parked' || Math.abs(o.x - nx) > reach || Math.abs(o.z - nz) > reach) continue
    const f = o.turn?.from
    if (o.state === 'turn' && f.axis === v.axis && f.line === v.line && f.dir === v.dir) continue // just ahead of us in our lane
    if (Math.abs(Math.cos(o.yaw - v.yaw)) < 0.75 || o.state === 'turn') return true
  }
  return false
}

// A police car with its siren on coming up behind: pull over and let it by.
function sirenBehind(v) {
  const s = Math.sin(v.yaw)
  const c = Math.cos(v.yaw)
  for (const o of vehicles) {
    if (!(o.chasing || o.lastmaOn) || o === v) continue
    const dx = o.x - v.x
    const dz = o.z - v.z
    const behind = -(dx * s + dz * c)
    if (behind > 0 && behind < 35 && Math.abs(dx * c - dz * s) < 4 && Math.cos(o.yaw - v.yaw) > 0.5) return true
  }
  return false
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

// Where each chasing police car aims, by its place in the pack. `pv`: your
// velocity (zero while they can't see you).
function roleTarget(v, chase, pv, n) {
  const sp = Math.hypot(pv.x, pv.z)
  if (sp > 3) {
    const fx = pv.x / sp
    const fz = pv.z / sp
    const lead = clamp(14 / sp, 0.6, 2.2) // seconds ahead of you
    if (v.role === 0) return { x: chase.x + pv.x * 0.25, z: chase.z + pv.z * 0.25 }
    const side = v.role % 2 ? 1 : -1
    if (v.role <= 2) return { x: chase.x + pv.x * lead - fz * 4.5 * side, z: chase.z + pv.z * lead + fx * 4.5 * side }
    return { x: chase.x - fx * 9 - fz * 3 * side, z: chase.z - fz * 9 + fx * 3 * side }
  }
  // You've stopped: a ring round you, a car on each side.
  const lead = vehicles.find((o) => o.chasing && o.role === 0) ?? v
  const base = Math.atan2(lead.x - chase.x, lead.z - chase.z)
  const a = base + (v.role * Math.PI * 2) / Math.max(1, n)
  return { x: chase.x + Math.sin(a) * 6.5, z: chase.z + Math.cos(a) * 6.5 }
}

// ctx: { focus, playerCar: {x,z} | null (only while driving), pedestrian: {x,z} | null, wanted,
//        chase: {x,z} where the police last saw you, hidden: they can't see you now }
export function updateTraffic(dt, ctx) {
  const { focus, wanted } = ctx
  const chasePoint = ctx.chase ?? focus
  const chasers = wanted > 0 ? Math.min(POLICE, wanted + 1) : 0
  // The closest police cars join the chase: closest to you while they can
  // see you, closest to where they last saw you while you're hidden (patrols
  // that never saw you don't magically know where you are).
  const police = vehicles.filter((v) => v.police && v.state !== 'parked')
  const near = ctx.hidden ? chasePoint : focus
  police.sort((a, b) => Math.hypot(a.x - near.x, a.z - near.z) - Math.hypot(b.x - near.x, b.z - near.z))
  police.forEach((v, k) => {
    const chase = k < chasers
    if (v.chasing && !chase && v.state === 'direct') snapToLane(v)
    v.chasing = chase
    v.role = k // 0 leads the chase, the others cut you off and box you in
  })
  const pack = police.filter((v) => v.chasing)
  const pv = ctx.hidden ? { x: 0, z: 0 } : (ctx.playerVel ?? { x: 0, z: 0 })

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
    // Police chasing you, or a LASTMA patrol after you for a red light.
    const pursuing = v.chasing || v.lastmaOn
    if (pursuing) {
      const lastma = !v.chasing
      const chase = lastma ? focus : chasePoint
      const toChase = Math.hypot(v.x - chase.x, v.z - chase.z)
      hunt = !lastma && ctx.hidden && toChase < 14 ? null : chase
      v.hunt = hunt
      // Far behind while you're in view: a closer patrol car takes over.
      if (!lastma && dist > 260 && !ctx.hidden) respawnNear(v, focus)
      if (v.state === 'lane' && hunt && toChase < 24) v.state = 'direct'
      if (v.state === 'direct') {
        if (!hunt || toChase > 45) {
          snapToLane(v)
        } else {
          // Each car has a job: the lead car comes at you from behind, the
          // next ones aim ahead of you on either side to cut you off; if you
          // stop, they park round you in a ring so you're boxed in.
          // LASTMA pull up alongside you (a few metres off) rather than ram you.
          const off = Math.hypot(v.x - chase.x, v.z - chase.z) || 1
          const goal = lastma ? { x: chase.x + ((v.x - chase.x) / off) * 4.5 + pv.x * 0.4, z: chase.z + ((v.z - chase.z) / off) * 4.5 + pv.z * 0.4 } : roleTarget(v, chase, pv, pack.length)
          // Keep clear of the other police cars.
          let ax = 0
          let az = 0
          for (const o of lastma ? [] : pack) {
            if (o === v) continue
            const dx = v.x - o.x
            const dz = v.z - o.z
            const d = Math.hypot(dx, dz)
            if (d < 9 && d > 0.01) {
              ax += (dx / d) * (9 - d)
              az += (dz / d) * (9 - d)
            }
          }
          const want = Math.atan2(goal.x - v.x + ax * 1.6, goal.z - v.z + az * 1.6)
          v.yaw += clamp(wrap(want - v.yaw), -2.6 * dt, 2.6 * dt)
          const toGoal = Math.hypot(goal.x - v.x, goal.z - v.z)
          let target = toGoal < 2 || stalled ? 0 : Math.min(lastma ? 20 : 24, toGoal * 1.4)
          // Slow down for a sharp turn instead of circling round the target.
          const turnNeed = Math.abs(wrap(want - v.yaw))
          if (turnNeed > 0.9) target = Math.min(target, 7)
          // Don't plough into traffic or the other police cars (you're fair game).
          const { gap } = blockedAhead(v, 14)
          if (gap < Infinity) target = Math.min(target, Math.max(0, gap - 1.5) * 1.6)
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

    const cruise = pursuing ? (hunt ? (v.chasing ? 26 : 21) : 14) : def.cruise

    if (v.state === 'lane') {
      const entry = nodeCoord(v.axis, v.node) - v.dir * (ROAD / 2)
      const toEntry = (entry - v.p) * v.dir
      let desired = stalled ? 0 : cruise

      // Danfos and kekes pull up at bus stops with people waiting (or riders to drop).
      if (def.picksUp && !pursuing) {
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

      const I = v.axis === 'x' ? v.node : v.line
      const J = v.axis === 'x' ? v.line : v.node
      let sideWant = 0
      if (!pursuing) {
        if (hasLight(I, J)) {
          const light = lightFor(v.axis)
          const mustStop = light === 'red' || (light === 'yellow' && toEntry > STOP_BACK + 1)
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
        // Wait at the line while someone is still crossing the junction.
        // (Measured from the front bumper, so the nose stays out of the box.)
        const nose = def.half[2] + 1
        if (toEntry > nose - 0.7 && toEntry < STOP_BACK + nose && boxBusy(v, roadX(I), roadZ(J))) desired = Math.min(desired, Math.max(0, toEntry - nose) * 1.2)
        const beforeQueue = desired
        const ahead = blockedAhead(v, 26)
        if (ahead.gap < Infinity) desired = Math.min(desired, Math.max(0, ahead.gap - 2.2) * 1.1)
        v.waitFor = ahead.who && ahead.gap < 4 && !stationary(ahead.who) ? ahead.who.id : null
        // Stuck behind something that isn't going anywhere (a parked or
        // wrecked car in the lane): pull out and go round it.
        const o = ahead.who
        if (o && stationary(o) && ahead.gap < 12) {
          const r = laneRight(v.axis, v.dir)
          const lane = lanePoint(v.axis, v.line, v.dir, v.p)
          const rel = (o.x - lane.x) * r.x + (o.z - lane.z) * r.z
          const e = extentFrom(o, v.yaw)
          sideWant = Math.max(-3.4, rel - e.lat - def.half[0] - 0.35)
          v.passing = o
        } else if (v.passing) {
          // Keep out until we're past it.
          const o2 = v.passing
          const behind = (o2.x - v.x) * Math.sin(v.yaw) + (o2.z - v.z) * Math.cos(v.yaw)
          if (behind < -(VEHICLES[o2.type].half[2] + def.half[2] + 1) || o2.state !== 'parked' && !stationary(o2)) v.passing = null
          else sideWant = Math.min(v.side, -0.5)
        }
        // Sirens behind: move over to the curb and slow down.
        if (!v.passing && sirenBehind(v)) {
          sideWant = 1.7
          desired = Math.min(desired, 4)
        }
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
        // Chasing: through red lights with the siren on, but not through
        // other cars (traffic pulls over to let them by).
        const ahead = blockedAhead(v, 22)
        // Something slow in the way: swing out towards the middle of the road
        // and go past it (traffic pulls over to the curb to help).
        const o = ahead.who
        if (o && ahead.gap < 14 && !(o.chasing || o.lastmaOn)) {
          const r = laneRight(v.axis, v.dir)
          const lane = lanePoint(v.axis, v.line, v.dir, v.p)
          const rel = (o.x - lane.x) * r.x + (o.z - lane.z) * r.z
          sideWant = Math.max(-3.6, Math.min(0, rel - extentFrom(o, v.yaw).lat - def.half[0] - 0.4))
          v.passing = o
        } else if (v.passing) {
          const o2 = v.passing
          const behind = (o2.x - v.x) * Math.sin(v.yaw) + (o2.z - v.z) * Math.cos(v.yaw)
          if (behind < -(VEHICLES[o2.type].half[2] + def.half[2] + 1)) v.passing = null
          else sideWant = Math.min(v.side, -0.5)
        }
        const blocking = ahead.gap < Infinity && !(v.passing && v.side < sideWant + 0.4)
        if (blocking) desired = Math.min(desired, Math.max(0, ahead.gap - 2.5) * 1.4)
        if (toEntry > 0 && toEntry < 12 && boxBusy(v, roadX(I), roadZ(J))) desired = Math.min(desired, 9)
        v.blockedBy = null
      }
      v.blockedFor = v.blockedBy ? (v.blockedFor ?? 0) + dt : 0

      v.speed += clamp(desired - v.speed, -16 * dt, def.accel * 0.4 * dt)
      v.p += v.dir * v.speed * dt
      v.side += clamp(sideWant - v.side, -2.2 * dt, 2.2 * dt)
      const pt = lanePoint(v.axis, v.line, v.dir, v.p)
      const r = laneRight(v.axis, v.dir)
      v.x = pt.x + r.x * v.side
      v.z = pt.z + r.z * v.side
      if ((entry - v.p) * v.dir <= 0) startTurn(v, pursuing ? v.hunt : null)
    } else if (v.state === 'turn') {
      const t = v.turn
      const turning = !t.next.straight
      let target = stalled ? 0 : turning ? Math.min(cruise, pursuing ? 14 : 7) : cruise
      // Something across our path in the junction: wait for it to clear.
      const ahead = blockedAhead(v, 14)
      if (ahead.gap < Infinity) target = Math.min(target, Math.max(0, ahead.gap - 1.8) * 1.3)
      v.waitFor = ahead.who && ahead.gap < 4 && !stationary(ahead.who) ? ahead.who.id : null
      v.speed += clamp(target - v.speed, -14 * dt, def.accel * 0.4 * dt)
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
    // Rarely three or more cars end up each waiting on the next: whoever has
    // waited longest edges forward for a moment to break the knot.
    v.nudgeFor = Math.max(0, (v.nudgeFor ?? 0) - dt)
    v.stuckFor = v.speed < 0.3 && v.waitFor != null ? (v.stuckFor ?? 0) + dt : 0
    if (v.stuckFor > 7) {
      v.stuckFor = 0
      v.nudgeFor = 2.5
    }
  }
}

// A LASTMA patrol comes after you: one already nearby, or one turns up on a
// road a little way behind. Returns the vehicle.
export function summonLastma(focus) {
  let v = vehicles.find((o) => o.type === 'lastma' && o.state !== 'parked' && Math.hypot(o.x - focus.x, o.z - focus.z) < 120)
  if (!v) {
    const spot = randomLanePosition(focus, 25, 55) ?? randomLanePosition(focus, 20, 120)
    if (!spot) return null
    // Borrow the farthest ordinary car for it.
    v = vehicles
      .filter((o) => !o.police && o.state !== 'parked' && !o.riders.length && !o.lastmaOn)
      .sort((a, b) => Math.hypot(b.x - focus.x, b.z - focus.z) - Math.hypot(a.x - focus.x, a.z - focus.z))[0]
    if (!v) return null
    v.type = 'lastma'
    v.color = VEHICLES.lastma.colors[0]
    v.dirty = true
    v.decor = false
    v.wrecked = false
    v.burning = 0
    v.hp = TRAFFIC_HP
    setLane(v, spot.axis, spot.line, spot.dir, spot.p)
    v.offX = v.offZ = 0
    v.speed = 8
  }
  v.lastmaOn = true
  return v
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
