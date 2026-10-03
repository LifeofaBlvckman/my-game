import { BEACH, BLOCK, city, ISLAND, MAINLAND, mulberry32, ROAD, SIDEWALK_Y } from './cityData'
import { COP_LOOK, lookFromSeed, randomLook, WARDEN_LOOK } from './people'

// Crowd simulation. Plain objects updated every frame; Pedestrians.jsx draws them.
const WALKERS = 70
const RECYCLE = 140
const FIGHT_RANGE = 1.15

const rand = mulberry32(77)
const regularBlocks = city.blocks.filter((b) => b.w === BLOCK)

export const npcs = []

function placeWalker(n, near) {
  const options = near ? regularBlocks.filter((b) => Math.hypot(b.x - near.x, b.z - near.z) < 110) : regularBlocks
  const b = options[Math.floor(rand() * options.length)] ?? regularBlocks[0]
  n.bx = b.x
  n.bz = b.z
  n.r = BLOCK / 2 - 1.6 + (rand() - 0.5) * 1.2
  n.t = rand() * n.r * 8
  n.dir = rand() < 0.5 ? 1 : -1
}

for (let k = 0; k < WALKERS; k++) {
  const n = { kind: 'walk', look: randomLook(rand), speed: 1.1 + rand() * 0.6, y: SIDEWALK_Y }
  placeWalker(n)
  npcs.push(n)
}

city.idlers.forEach((spot, k) => {
  const look =
    spot.role === 'bouncer'
      ? lookFromSeed(900 + k, { female: false, face: 1, top: '#2a2633', bottom: '#2a2633', hair: 'bald', skin: '#5a3624', robe: false, height: 1.18 })
      : spot.role === 'trader'
        ? randomLook(rand, { robe: true })
        : spot.role === 'warden'
          ? { ...WARDEN_LOOK, face: k % 6 }
          : randomLook(rand)
  npcs.push({ kind: 'idle', look, x: spot.x, z: spot.z, y: spot.y, yaw: spot.yaw, role: spot.role, home: { ...spot } })
})

city.wanderAreas.forEach((area) => {
  for (let k = 0; k < area.count; k++) {
    npcs.push({
      kind: 'wander',
      look: randomLook(rand),
      area,
      x: area.x + (rand() - 0.5) * area.w,
      z: area.z + (rand() - 0.5) * area.d,
      y: area.y,
      pause: rand() * 3,
      speed: 0.9 + rand() * 0.4,
    })
  }
})

// People waiting at bus stops for a danfo or keke.
const WAITING_PER_STOP = 3
const stopSpot = (stop, k) => {
  // Spread along the curb, either side of the shelter.
  const along = (k - 1) * 1.1
  return { x: stop.x + (stop.axis === 'x' ? along : 0), z: stop.z + (stop.axis === 'z' ? along : 0) }
}
city.busStops.forEach((stop) => {
  for (let k = 0; k < WAITING_PER_STOP; k++) {
    const spot = stopSpot(stop, k)
    npcs.push({ kind: 'idle', role: 'waiting', stop: stop.id, look: randomLook(rand), x: spot.x, z: spot.z, y: SIDEWALK_Y, yaw: stop.yaw, home: { ...spot, yaw: stop.yaw } })
  }
})

// Police officers on foot. Hidden until a patrol car pulls up during a chase.
const COPS = 6
for (let k = 0; k < COPS; k++) {
  npcs.push({ kind: 'cop', role: 'cop', look: { ...COP_LOOK, height: 0.98 + k * 0.015 }, active: false, x: 0, z: 0, y: 0 })
}

// Common per-NPC state.
npcs.forEach((n) => {
  n.yaw ??= 0
  n.phase = rand() * 10
  n.moving = false
  n.down = 0 // seconds left lying on the ground
  n.panic = 0
  n.flinch = 0
  n.fight = 0 // seconds left fighting the player
  n.punchT = -1
  n.punchCooldown = 0
  n.hp = n.role === 'bouncer' ? 4 : n.role === 'cop' ? 3 : 2
  // Bouncers always fight back; about one in four others will too.
  n.tough = n.role === 'bouncer' || (n.role !== 'trader' && n.role !== 'cop' && rand() < 0.25)
  n.vx = 0
  n.vz = 0
  n.ox = 0 // push offset (from the player bumping into them)
  n.oz = 0
})

function loopPoint(n) {
  const r = n.r
  const L = 8 * r
  n.t = ((n.t % L) + L) % L
  const seg = Math.floor(n.t / (2 * r))
  const u = n.t - seg * 2 * r - r
  const [x, z, yaw] = [
    [u, -r, Math.PI / 2],
    [r, u, 0],
    [-u, r, -Math.PI / 2],
    [-r, -u, Math.PI],
  ][seg]
  return { x: n.bx + x, z: n.bz + z, yaw: n.dir > 0 ? yaw : yaw + Math.PI }
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a))

function panicAround(n, radius = 20) {
  for (const o of npcs) {
    if (o !== n && o.fight <= 0 && o.x !== undefined && Math.hypot(o.x - n.x, o.z - n.z) < radius) o.panic = 6
  }
}

export function knockDown(n, dx, dz, force) {
  const d = Math.hypot(dx, dz) || 1
  n.vx = (dx / d) * Math.min(10, force)
  n.vz = (dz / d) * Math.min(10, force)
  n.down = 5
  n.fight = 0
  n.punchT = -1
  n.hp = n.role === 'bouncer' ? 4 : n.role === 'cop' ? 3 : 2
  n.yaw = Math.atan2(-dx, -dz) // fall away from the hit
  panicAround(n)
}

// The player punched this NPC. Returns 'down' or 'hurt'.
export function punchNpc(n, fromX, fromZ) {
  const dx = n.x + n.ox - fromX
  const dz = n.z + n.oz - fromZ
  if (n.down > 0) return 'down'
  n.hp -= 1
  if (n.hp <= 0) {
    knockDown(n, dx, dz, 5)
    return 'down'
  }
  n.flinch = 0.4
  const d = Math.hypot(dx, dz) || 1
  n.ox += (dx / d) * 0.5
  n.oz += (dz / d) * 0.5
  n.yaw = Math.atan2(-dx, -dz)
  if (n.tough) n.fight = 12
  else panicAround(n, 12)
  return 'hurt'
}

// Nearest standing NPC within `radius` of a point.
export function npcNear(x, z, radius) {
  let best = null
  let bestD = radius
  for (const n of npcs) {
    if (n.x === undefined || n.active === false) continue
    const d = Math.hypot(n.x + n.ox - x, n.z + n.oz - z)
    if (d < bestD) {
      best = n
      bestD = d
    }
  }
  return best
}

// A patrol car has pulled up: an officer gets out on the driver's side.
export function deployCop(car, focus) {
  const n = npcs.find((o) => o.kind === 'cop' && !o.active)
  if (!n) return null
  const left = car.yaw + Math.PI / 2
  n.active = true
  n.returning = false
  n.grab = false
  n.car = car
  n.x = car.x + Math.sin(left) * 1.4
  n.z = car.z + Math.cos(left) * 1.4
  n.yaw = Math.atan2(focus.x - n.x, focus.z - n.z)
  n.down = n.fight = n.panic = 0
  n.hp = 3
  car.officerOut = true
  return n
}

// Officers head back to their cars (chase over, or you got in a car).
export function recallCops() {
  for (const n of npcs) if (n.kind === 'cop' && n.active) n.returning = true
}

// You stopped again: officers on their way back come for you instead.
export function resumeCops() {
  for (const n of npcs) if (n.kind === 'cop' && n.active) n.returning = false
}

// --- Bus stop passengers ---

// How many people are waiting at each stop, indexed by stop id.
export function waitingCounts() {
  const counts = new Array(city.busStops.length).fill(0)
  for (const n of npcs) if (n.role === 'waiting' && n.kind === 'idle' && n.active !== false && n.down <= 0) counts[n.stop]++
  return counts
}

// A vehicle has stopped at `stop`: up to `max` waiting people walk to it and
// get in. `vehicle` is any object with x, z, yaw and a riders array.
export function callBoarders(stop, vehicle, max) {
  let called = 0
  for (const n of npcs) {
    if (called >= max) break
    if (n.role !== 'waiting' || n.stop !== stop.id || n.kind !== 'idle' || n.active === false || n.down > 0) continue
    n.kind = 'boarding'
    n.vehicle = vehicle
    called++
  }
  return called
}

// Riders get out at `stop` and wait there for the next ride.
export function alightRiders(stop, vehicle, count = vehicle.riders.length) {
  const out = vehicle.riders.splice(0, count)
  out.forEach((n, k) => {
    const spot = stopSpot(stop, k % WAITING_PER_STOP)
    const left = vehicle.yaw + Math.PI / 2
    n.active = true
    n.kind = 'idle'
    n.role = 'waiting'
    n.stop = stop.id
    n.vehicle = null
    n.x = vehicle.x + Math.sin(left) * 1.5
    n.z = vehicle.z + Math.cos(left) * 1.5
    n.home = { ...spot, yaw: stop.yaw }
    n.posed = false
  })
  return out.length
}

export const copsGrabbing = () => npcs.some((n) => n.kind === 'cop' && n.active && n.grab && n.down <= 0)

function standDownCop(n) {
  n.active = false
  n.grab = false
  if (n.car) n.car.officerOut = false
  n.car = null
}

// Dragged out of a car you're jacking: they hit the ground, then either run
// off or come back swinging. A passer-by from far away takes the part.
export function ejectDriver(x, z, yaw, focus) {
  let pick = null
  let far = -1
  for (const n of npcs) {
    if (n.kind !== 'walk' || n.down > 0) continue
    const d = Math.hypot(n.x - focus.x, n.z - focus.z)
    if (d > far) {
      far = d
      pick = n
    }
  }
  if (!pick) return
  const left = yaw + Math.PI / 2
  knockDown(pick, Math.sin(left), Math.cos(left), 3)
  // Position after knocking down: knockDown snaps walkers to their route.
  pick.kind = 'loose'
  pick.x = x + Math.sin(left) * 1.6
  pick.z = z + Math.cos(left) * 1.6
  if (!walkable(pick.x, pick.z)) {
    // The car door opens over the water (edge of a bridge): out on the deck side instead.
    pick.x = x - (pick.x - x)
    pick.z = z - (pick.z - z)
  }
  pick.ox = pick.oz = 0
  pick.down = 1.4
  pick.afterDown = rand() < 0.35 ? 'fight' : 'flee'
}

// A driver gets out of their car on their own: to argue after a crash, or to
// run from a fire.
export function driverGetsOut(x, z, yaw, focus, mood) {
  let pick = null
  let far = -1
  for (const n of npcs) {
    if (n.kind !== 'walk' || n.down > 0) continue
    const d = Math.hypot(n.x - focus.x, n.z - focus.z)
    if (d > far) {
      far = d
      pick = n
    }
  }
  if (!pick) return null
  const left = yaw + Math.PI / 2
  pick.kind = 'loose'
  pick.x = x + Math.sin(left) * 1.5
  pick.z = z + Math.cos(left) * 1.5
  if (!walkable(pick.x, pick.z)) {
    // The car door opens over the water (edge of a bridge): out on the deck side instead.
    pick.x = x - (pick.x - x)
    pick.z = z - (pick.z - z)
  }
  pick.ox = pick.oz = pick.vx = pick.vz = 0
  pick.down = 0
  pick.yaw = Math.atan2(focus.x - pick.x, focus.z - pick.z)
  if (mood === 'fight') pick.fight = 14
  else pick.panic = 8
  return pick
}

// Ground people can stand on: the two landmasses with their beaches, and
// the bridge decks. (Building interiors sit far to the east, past x = 1500.)
const LAND = [
  { minX: MAINLAND.minX - BEACH, maxX: MAINLAND.maxX, minZ: MAINLAND.minZ - BEACH, maxZ: MAINLAND.maxZ + BEACH },
  { minX: ISLAND.minX, maxX: ISLAND.maxX + BEACH, minZ: ISLAND.minZ - BEACH, maxZ: ISLAND.maxZ + BEACH },
]
export function walkable(x, z) {
  if (x > 1500) return true
  for (const r of LAND) if (x > r.minX + 0.5 && x < r.maxX - 0.5 && z > r.minZ + 0.5 && z < r.maxZ - 0.5) return true
  return city.bridges.some((b) => x > b.x0 - 1 && x < b.x1 + 1 && Math.abs(z - b.z) < ROAD / 2 + 0.6)
}

// Move to (x, z) if it's solid ground; otherwise slide along the edge, or
// stay put. Nobody walks on water.
function stepTo(n, x, z) {
  if (walkable(x, z)) {
    n.x = x
    n.z = z
  } else if (walkable(x, n.z)) n.x = x
  else if (walkable(n.x, z)) n.z = z
  else return false
  return true
}

function walkToward(n, tx, tz, speed, dt) {
  const dx = tx - n.x
  const dz = tz - n.z
  const d = Math.hypot(dx, dz)
  if (d < 0.05) return d
  const step = Math.min(d, speed * dt)
  stepTo(n, n.x + (dx / d) * step, n.z + (dz / d) * step)
  n.yaw += wrap(Math.atan2(dx, dz) - n.yaw) * Math.min(1, dt * 8)
  n.moving = true
  return d
}

// focus: where the player is. car: { x, z, yaw, speed, half } when driving, else null.
// Returns the positions of NPCs the car knocked down this frame. NPC punches
// that land on the player are pushed to `events`.
// How close an officer has to get to a player sitting in a car (0 if the car
// is moving too fast to be arrested in).
let copReach = 0
export function setCarArrestReach(reach) {
  copReach = reach
}

// Every few seconds, stops that a bus has emptied fill up again: someone
// walking past joins the queue, or (out of sight) a walker is moved there.
let refillTimer = 0
function refillStops(focus) {
  const counts = waitingCounts()
  city.busStops.forEach((stop) => {
    const hidden = Math.hypot(stop.x - focus.x, stop.z - focus.z) > 90
    // Too many people dropped off here: the extras go about their day.
    if (counts[stop.id] > WAITING_PER_STOP + 2 && hidden) {
      const extra = npcs.find((n) => n.role === 'waiting' && n.stop === stop.id && n.kind === 'idle' && n.active !== false)
      if (extra) {
        extra.role = null
        extra.home = null
        extra.kind = 'walk'
        extra.speed ??= 1.1 + rand() * 0.6
        placeWalker(extra, focus)
      }
      return
    }
    if (counts[stop.id] >= WAITING_PER_STOP) return
    let pick = null
    for (const n of npcs) {
      if (n.kind !== 'walk' || n.down > 0 || n.panic > 0 || n.x === undefined) continue
      const d = Math.hypot(n.x - stop.x, n.z - stop.z)
      if (d < 25 || (hidden && Math.hypot(n.x - focus.x, n.z - focus.z) > 90)) {
        pick = n
        if (d < 25) break
      }
    }
    if (!pick) return
    const spot = stopSpot(stop, counts[stop.id] % WAITING_PER_STOP)
    if (Math.hypot(pick.x - stop.x, pick.z - stop.z) >= 25) {
      pick.x = spot.x
      pick.z = spot.z
    }
    pick.kind = 'idle'
    pick.role = 'waiting'
    pick.stop = stop.id
    pick.y = SIDEWALK_Y
    pick.home = { ...spot, yaw: stop.yaw }
    pick.posed = false
  })
}

export function updatePedestrians(dt, focus, car, playerOnFoot, events = []) {
  const hits = []
  refillTimer -= dt
  if (refillTimer <= 0) {
    refillTimer = 3
    refillStops(focus)
  }
  for (const n of npcs) {
    const dx = (n.x ?? 0) - focus.x
    const dz = (n.z ?? 0) - focus.z
    const far = dx * dx + dz * dz > 160 * 160
    if (far && n.kind !== 'walk' && n.kind !== 'cop') continue
    n.flinch = Math.max(0, n.flinch - dt)

    if (n.active === false) continue
    if (n.down > 0) {
      n.down -= dt
      // Knocked flying, but never off the edge into the water.
      if (!stepTo(n, n.x + n.vx * dt, n.z + n.vz * dt)) n.vx = n.vz = 0
      const drag = Math.exp(-3 * dt)
      n.vx *= drag
      n.vz *= drag
      if (n.down <= 0 && n.afterDown) {
        if (n.afterDown === 'fight') n.fight = 12
        else n.panic = 8
        n.afterDown = null
      }
      continue
    }
    n.panic = Math.max(0, n.panic - dt)
    n.moving = false

    if (n.kind === 'cop') {
      // Chase the player down and grab them; or walk back to the car.
      const toPlayer = Math.hypot(focus.x - n.x, focus.z - n.z)
      // On foot they grab you; in a stopped car they reach in through the door.
      const reach = playerOnFoot ? 1.05 : copReach
      const holding = n.grab ? toPlayer < reach + 0.55 : toPlayer <= reach
      n.grab = false
      if (toPlayer > 150) {
        standDownCop(n)
        continue
      }
      if (n.returning || (!playerOnFoot && !copReach)) {
        const car = n.car
        if (!car || walkToward(n, car.x, car.z, 2.2, dt) < 1.6) standDownCop(n)
      } else if (!holding) {
        walkToward(n, focus.x, focus.z, 6.2, dt)
      } else {
        n.yaw += wrap(Math.atan2(focus.x - n.x, focus.z - n.z) - n.yaw) * Math.min(1, dt * 10)
        n.grab = true
      }
    } else if (n.fight > 0 && playerOnFoot) {
      // Square up to the player and throw punches.
      n.fight -= dt
      n.punchCooldown -= dt
      const d = Math.hypot(focus.x - n.x, focus.z - n.z)
      if (d > 18) n.fight = 0
      if (d > FIGHT_RANGE) walkToward(n, focus.x, focus.z, 3.4, dt)
      else n.yaw += wrap(Math.atan2(focus.x - n.x, focus.z - n.z) - n.yaw) * Math.min(1, dt * 10)
      if (n.punchT >= 0) {
        const before = n.punchT
        n.punchT += dt * 3
        if (before < 0.5 && n.punchT >= 0.5 && d < FIGHT_RANGE + 0.4) events.push({ type: 'npcPunch', x: n.x, z: n.z, damage: n.role === 'bouncer' ? 12 : 7 })
        if (n.punchT > 1) n.punchT = -1
      } else if (d < FIGHT_RANGE + 0.2 && n.punchCooldown <= 0) {
        n.punchT = 0
        n.punchSide = -(n.punchSide ?? 1)
        n.punchCooldown = n.role === 'bouncer' ? 0.8 : 1.1
      }
    } else if (n.fight > 0) {
      n.fight = 0
    } else if (n.kind === 'boarding') {
      // Walk to the vehicle's door and climb in; give up if it drives off.
      const v = n.vehicle
      const left = v.yaw + Math.PI / 2
      const doorX = v.x + Math.sin(left) * 1.4
      const doorZ = v.z + Math.cos(left) * 1.4
      if (Math.hypot(doorX - n.x, doorZ - n.z) > 14 || v.gone) {
        n.kind = 'idle'
        n.vehicle = null
      } else if (walkToward(n, doorX, doorZ, 2.6, dt) < 0.5) {
        n.active = false
        n.kind = 'riding'
        v.riders.push(n)
      }
    } else if (n.kind === 'loose') {
      // Out of a car: run from the player while scared, then rejoin the crowd
      // once well out of sight.
      const away = Math.atan2(n.x - focus.x, n.z - focus.z)
      if (n.panic > 0) walkToward(n, n.x + Math.sin(away) * 5, n.z + Math.cos(away) * 5, 4, dt)
      if (Math.hypot(n.x - focus.x, n.z - focus.z) > 120) {
        n.kind = 'walk'
        placeWalker(n, focus)
      }
    } else if (n.kind === 'walk') {
      if (far && dx * dx + dz * dz > RECYCLE * RECYCLE) placeWalker(n, focus)
      n.t += n.dir * n.speed * (n.panic > 0 ? 3.2 : 1) * dt
      const p = loopPoint(n)
      // Ease back onto the loop after being knocked off it.
      if (n.x !== undefined && Math.hypot(p.x - n.x, p.z - n.z) > 0.5) {
        walkToward(n, p.x, p.z, 2.5, dt)
      } else {
        n.x = p.x
        n.z = p.z
        n.yaw += wrap(p.yaw - n.yaw) * Math.min(1, dt * 8)
        n.moving = true
      }
    } else if (n.kind === 'wander') {
      const pace = n.panic > 0 ? 3.2 : 1
      if (n.pause > 0) {
        n.pause -= dt * pace
        if (n.pause <= 0) {
          n.tx = n.area.x + (Math.random() - 0.5) * n.area.w
          n.tz = n.area.z + (Math.random() - 0.5) * n.area.d
        }
      } else if (walkToward(n, n.tx, n.tz, n.speed * pace, dt) < 0.3) {
        n.pause = 1 + Math.random() * 4
      }
    } else if (n.home) {
      // Idlers go back to their spot after any trouble.
      if (walkToward(n, n.home.x, n.home.z, 1.6, dt) < 0.1) {
        n.yaw += wrap(n.home.yaw - n.yaw) * Math.min(1, dt * 4)
        n.moving = false
      }
    }

    // Shrug off bumps from the player.
    if (playerOnFoot) {
      const px = n.x + n.ox - focus.x
      const pz = n.z + n.oz - focus.z
      const d = Math.hypot(px, pz)
      if (d < 0.6 && d > 0.001) {
        n.ox += (px / d) * (0.6 - d)
        n.oz += (pz / d) * (0.6 - d)
      }
    }
    const decay = Math.exp(-1.5 * dt)
    n.ox *= decay
    n.oz *= decay

    // Getting hit by the player's car.
    if (car && Math.abs(car.speed) > 4) {
      const rx = n.x + n.ox - car.x
      const rz = n.z + n.oz - car.z
      const c = Math.cos(car.yaw)
      const s = Math.sin(car.yaw)
      const lx = rx * c - rz * s
      const lz = rx * s + rz * c
      if (Math.abs(lx) < car.half[0] + 0.3 && Math.abs(lz) < car.half[2] + 0.3) {
        knockDown(n, rx, rz, Math.abs(car.speed) * 0.5)
        hits.push({ x: n.x, z: n.z })
      }
    }
  }
  return hits
}
