import { npcs } from './crowd'
import { fx } from './particles'
import { boom } from './audio'
import { POLICE, snapToLane, vehicles } from './trafficSim'
import { VEHICLES } from './vehicleTypes'
import { world } from './state'

// Everyone online sees the same city. The room's host (the longest-connected
// player) runs the traffic and the crowd; when you get mixed up with a car or
// a person (crash into it, jack it, punch them) you take it over ("claim" it)
// and run it yourself until you're done with it. Everyone sends the share of
// the world they run a few times a second, and draws everybody else's share
// as "puppets" that glide to where their owner says they are.
//
// Each player's own police (vehicles 0..POLICE-1, the officers on foot) and
// the fixed characters (traders, guards, soldiers...) stay private: other
// players see your chase through RemoteChase instead.

const SEND_EVERY = 200 // ms between snapshots
const RELEASE_AFTER = 8000 // ms of calm before a claim goes back to the host
const NEAR_REMOTE = 220 // only send what's near someone who can see it
const STALE = 2500 // ms without news: a puppet stops where it is

const TYPES = Object.keys(VEHICLES)
const KINDS = ['walk', 'idle', 'boarding', 'riding', 'loose', 'wander']
const r1 = (v) => Math.round(v * 10)
const r2 = (v) => Math.round(v * 100)
const r3 = (v) => Math.round(v * 1000)

const VF = { parked: 1, wrecked: 2, chasing: 4, lastma: 8, officer: 16, direct: 32, police: 64, dwell: 128, decor: 256, turn: 512 }
const NF = { moving: 1, down: 2, panic: 4, hidden: 8, fight: 16, waiting: 32, aim: 64 }

export const sharedVehicle = (v) => v.id >= POLICE
export const vKey = (v) => `v${v.id}`
export const nKey = (n) => `n${n.index}`

const net = () => (world.net && world.net.id !== null && world.net.hostId != null ? world.net : null)
function ownerOf(key) {
  const n = net()
  return n ? (n.owners.get(key) ?? n.hostId) : null
}
const mine = (key) => {
  const n = net()
  return !n || ownerOf(key) === n.id
}
// Do we simulate this one, or just draw what its owner sends?
export const runsVehicle = (v) => !sharedVehicle(v) || mine(vKey(v))
export const runsNpc = (n) => !n.shared || mine(nKey(n))

// --- Claims ---
const claims = new Map() // key -> last time we touched it

function claim(key) {
  const n = net()
  if (!n) return
  claims.set(key, performance.now())
  if (ownerOf(key) === n.id) return
  n.owners.set(key, n.id)
  n.send({ t: 'claim', k: [key] })
}
export function claimVehicle(v) {
  if (!v || !sharedVehicle(v)) return
  claim(vKey(v))
  v.touched = true
  for (const r of v.riders ?? []) if (r.shared) claim(nKey(r))
}
export function claimNpc(n) {
  if (n?.shared) claim(nKey(n))
}

const calmVehicle = (v) => v.state !== 'direct' && !v.wrecked && !(v.burning > 0) && !(v.stall > 0) && !v.chasing && !v.lastmaOn
const calmNpc = (n) => !(n.down > 0) && !(n.fight > 0) && !(n.panic > 0) && n.kind !== 'loose' && n.kind !== 'boarding'

function releaseCalm(now) {
  const n = net()
  if (!n) return claims.clear()
  const back = []
  for (const [key, at] of claims) {
    const id = Number(key.slice(1))
    const thing = key[0] === 'v' ? vehicles.find((v) => v.id === id) : npcs[id]
    const far = thing && Math.hypot((thing.x ?? 0) - world.focus.x, (thing.z ?? 0) - world.focus.z) > 160
    const calm = !thing || (key[0] === 'v' ? calmVehicle(thing) : calmNpc(thing))
    if (calm) {
      if (now - at < RELEASE_AFTER && !far) continue
    } else {
      claims.set(key, now)
      continue
    }
    claims.delete(key)
    if (n.owners.get(key) === n.id) {
      n.owners.delete(key)
      back.push(key)
    }
  }
  if (back.length) n.send({ t: 'release', k: back })
}

// --- Where everyone is (the host keeps traffic and people around all of them) ---
// Inside a building you're off the map; the city around the door is what matters.
const outdoors = (p) => p && p.x < 1500 && (p.y ?? 0) > -20
export function updateFoci() {
  const list = [world.simFocus ?? world.focus]
  const n = world.net
  if (n) for (const r of n.remotes.values()) if (r.samples?.length && outdoors(r)) list.push({ x: r.x, z: r.z, remote: r })
  world.foci = list
  return list
}

// --- Sending ---
function vehicleRow(v) {
  let f = 0
  if (v.state === 'parked') f |= VF.parked
  if (v.wrecked) f |= VF.wrecked
  if (v.chasing) f |= VF.chasing
  if (v.lastmaOn) f |= VF.lastma
  if (v.officerOut) f |= VF.officer
  if (v.state === 'direct') f |= VF.direct
  if (v.state === 'turn') f |= VF.turn
  if (v.police) f |= VF.police
  if (v.dwell > 0) f |= VF.dwell
  if (v.decor) f |= VF.decor
  const row = [v.id, TYPES.indexOf(v.type), v.color, r1(v.x + (v.offX ?? 0)), r1(v.z + (v.offZ ?? 0)), r3(v.yaw), r1(v.speed), f, Math.round(v.hp), r1(v.burning ?? 0), r2(v.side ?? 0)]
  for (const r of v.riders.slice(0, 8)) row.push(r.index)
  return row
}

function npcRow(n) {
  let f = 0
  if (n.moving) f |= NF.moving
  if (n.down > 0) f |= NF.down
  if (n.panic > 0) f |= NF.panic
  if (n.active === false) f |= NF.hidden
  if (n.fight > 0) f |= NF.fight
  if (n.role === 'waiting') f |= NF.waiting
  if (n.aim > 0.5) f |= NF.aim
  const row = [n.index, KINDS.indexOf(n.kind), r1(n.x ?? 0), r1(n.z ?? 0), r2(n.yaw ?? 0), f, r2(n.y ?? 0), r1(n.punchT ?? -1), n.stop ?? -1]
  if (n.kind === 'walk' && n.bx !== undefined) row.push(r1(n.bx), r1(n.bz), r2(n.r), r2(n.t), n.dir, r2(n.speed))
  return row
}

let lastSend = 0
let tick = 0
function send(now) {
  const n = net()
  if (!n || now - lastSend < SEND_EVERY) return
  lastSend = now
  tick++
  const watchers = [...n.remotes.values()].filter((r) => r.samples?.length && outdoors(r))
  if (!watchers.length) return
  const seen = (o) => o.x !== undefined && watchers.some((r) => Math.abs(r.x - o.x) < NEAR_REMOTE && Math.abs(r.z - o.z) < NEAR_REMOTE)
  const v = []
  for (const car of vehicles) {
    if (!sharedVehicle(car) || !mine(vKey(car))) continue
    // Parked cars nobody has touched are the same for everyone already.
    if (car.state === 'parked' && car.decor && !car.touched) continue
    if (seen(car)) v.push(vehicleRow(car))
  }
  // People on their pavement loop walk the same way on everyone's screen, so
  // they only need a reminder now and then; everyone else every time.
  const p = []
  for (const person of npcs) {
    if (!person.shared || !mine(nKey(person))) continue
    const calm = !(person.down > 0) && !(person.panic > 0) && !(person.fight > 0)
    if (calm && ((person.kind === 'walk' && tick % 3) || ((person.kind === 'wander' || person.kind === 'idle') && tick % 2))) continue
    if (seen(person) || person.kind === 'riding') p.push(npcRow(person))
  }
  if (v.length || p.length) n.send({ t: 'w', v, n: p })
}

// --- Receiving ---
export function applySnapshot(from, msg) {
  const now = performance.now()
  for (const row of msg.v ?? []) {
    const v = vehicles.find((o) => o.id === row[0])
    if (!v || !sharedVehicle(v) || ownerOf(vKey(v)) !== from) continue
    const type = TYPES[row[1]] ?? v.type
    if (type !== v.type || row[2] !== v.color) {
      v.type = type
      if (typeof row[2] === 'string' && row[2]) v.color = row[2]
      v.dirty = true
    }
    const f = row[7]
    const wasWrecked = v.wrecked
    v.net = { x: row[3] / 10, z: row[4] / 10, yaw: row[5] / 1000, speed: row[6] / 10, at: now }
    if (v.x === undefined || Math.hypot(v.net.x - v.x, v.net.z - v.z) > 15) {
      v.x = v.net.x
      v.z = v.net.z
      v.yaw = v.net.yaw
    }
    // (Turning shows as 'lane': we don't have their curve, only where they are.)
    v.state = f & VF.parked ? 'parked' : f & VF.direct ? 'direct' : 'lane'
    v.wrecked = !!(f & VF.wrecked)
    v.chasing = !!(f & VF.chasing)
    v.lastmaOn = !!(f & VF.lastma)
    v.officerOut = !!(f & VF.officer)
    v.police = !!(f & VF.police)
    v.decor = !!(f & VF.decor)
    v.dwell = f & VF.dwell ? 1 : 0
    v.hp = row[8]
    v.burning = row[9] / 10
    v.side = row[10] / 100
    v.touched = true
    // Their car blew up: the bang (just the picture and the noise; the owner deals the damage).
    if (v.wrecked && !wasWrecked) {
      fx.explosion(v.x, 0.5, v.z)
      boom()
    }
    const riders = row.slice(11).map((i) => npcs[i]).filter(Boolean)
    if (riders.length !== v.riders.length || riders.some((r, k) => r !== v.riders[k])) v.riders = riders
  }
  for (const row of msg.n ?? []) {
    const n = npcs[row[0]]
    if (!n || !n.shared || ownerOf(nKey(n)) !== from) continue
    n.kind = KINDS[row[1]] ?? n.kind
    const f = row[5]
    n.net = { x: row[2] / 10, z: row[3] / 10, yaw: row[4] / 100, at: now }
    n.moving = !!(f & NF.moving)
    n.down = f & NF.down ? Math.max(n.down, 1) : 0
    n.panic = f & NF.panic ? Math.max(n.panic, 1) : 0
    n.active = !(f & NF.hidden)
    n.fight = f & NF.fight ? 1 : 0
    n.aim = f & NF.aim ? 1 : 0
    n.role = f & NF.waiting ? 'waiting' : n.role === 'waiting' ? null : n.role
    n.y = row[6] / 100
    n.punchT = row[7] / 10
    n.stop = row[8] >= 0 ? row[8] : n.stop
    if (row.length > 9) {
      n.bx = row[9] / 10
      n.bz = row[10] / 10
      n.r = row[11] / 100
      n.t = row[12] / 100
      n.dir = row[13]
      n.speed = row[14] / 100
    }
    if (n.x === undefined || Math.hypot(n.net.x - n.x, n.net.z - n.z) > 12) {
      n.x = n.net.x
      n.z = n.net.z
      n.yaw = n.net.yaw
      n.posed = false
    }
  }
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a))

// Puppet cars carry on along their heading between snapshots and ease into
// where their owner last put them.
// One that's had no news for a while is somewhere its owner isn't telling us
// about (out of everyone's sight): take it off our map rather than leave a
// stale copy standing about.
export function drivePuppet(v, dt, now) {
  const s = v.net
  v.away = !s || now - s.at > STALE
  if (v.away) {
    v.speed = 0
    return
  }
  v.speed = s.speed
  const age = Math.min(0.5, (now - s.at) / 1000)
  const px = s.x + Math.sin(s.yaw) * s.speed * age
  const pz = s.z + Math.cos(s.yaw) * s.speed * age
  v.x += Math.sin(v.yaw) * v.speed * dt
  v.z += Math.cos(v.yaw) * v.speed * dt
  const k = Math.min(1, dt * 5)
  v.x += (px - v.x) * k
  v.z += (pz - v.z) * k
  v.yaw += wrap(s.yaw - v.yaw) * Math.min(1, dt * 8)
  v.spin += (v.speed * dt) / VEHICLES[v.type].wheels.r
}

// Puppet people: walkers follow their pavement loop like everyone else's
// copy; the rest walk to where their owner says.
export function movePuppet(n, dt, now, loopPoint) {
  // Walkers on their loop stay in step for a while after the last reminder.
  n.away = !n.net || now - n.net.at > (n.kind === 'walk' ? STALE * 3 : STALE)
  if (n.away) return
  if (n.kind === 'walk' && n.bx !== undefined && !(n.down > 0)) {
    n.t += n.dir * n.speed * (n.panic > 0 ? 3.2 : 1) * dt
    const p = loopPoint(n)
    if (n.x === undefined || Math.hypot(p.x - n.x, p.z - n.z) > 6) {
      n.x = p.x
      n.z = p.z
    } else {
      const k = Math.min(1, dt * 6)
      n.x += (p.x - n.x) * k
      n.z += (p.z - n.z) * k
    }
    n.yaw += wrap(p.yaw - n.yaw) * Math.min(1, dt * 8)
    n.moving = true
    return
  }
  const s = n.net
  const k = Math.min(1, dt * 7)
  const before = Math.hypot(s.x - n.x, s.z - n.z)
  n.x += (s.x - n.x) * k
  n.z += (s.z - n.z) * k
  n.yaw += wrap(s.yaw - n.yaw) * Math.min(1, dt * 8)
  n.moving = before > 0.05 || n.moving
}

// Things we've just started running ourselves (a claim, or we became the
// host) carry on from where they were drawn.
function adopt() {
  for (const v of vehicles) {
    if (!sharedVehicle(v)) continue
    const runs = runsVehicle(v)
    if (runs) v.away = false
    if (runs && v.puppet) {
      v.speed = v.net?.speed ?? v.speed
      if (v.state === 'lane' || v.state === 'turn' || v.state === 'direct') snapToLane(v)
      v.offX = v.offZ = 0
    }
    v.puppet = !runs
  }
  for (const n of npcs) {
    if (!n.shared) continue
    const runs = runsNpc(n)
    if (runs) n.away = false
    if (runs && n.puppet) {
      if (n.kind === 'boarding' && !n.vehicle) n.kind = n.role === 'waiting' ? 'idle' : 'walk'
      if (n.kind === 'idle' && n.role === 'waiting' && !n.home) n.home = { x: n.x, z: n.z, yaw: n.yaw }
      if (n.kind === 'riding' && !vehicles.some((v) => v.riders.includes(n))) {
        n.kind = 'walk'
        n.active = true
      }
    }
    n.puppet = !runs
  }
}

// Every frame, before the traffic and the crowd move.
export function updateWorldSync() {
  const now = performance.now()
  updateFoci()
  adopt()
  releaseCalm(now)
  send(now)
}
