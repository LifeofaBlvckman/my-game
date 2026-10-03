import { BLOCK, city, mulberry32, SIDEWALK_Y } from './cityData'
import { lookFromSeed, randomLook } from './people'

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
  n.hp = n.role === 'bouncer' ? 4 : 2
  // Bouncers always fight back; about one in four others will too.
  n.tough = n.role === 'bouncer' || (n.role !== 'trader' && rand() < 0.25)
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

function freezeLoop(n) {
  if (n.kind !== 'walk') return
  const p = loopPoint(n)
  n.x = p.x
  n.z = p.z
}

export function knockDown(n, dx, dz, force) {
  freezeLoop(n)
  const d = Math.hypot(dx, dz) || 1
  n.vx = (dx / d) * Math.min(10, force)
  n.vz = (dz / d) * Math.min(10, force)
  n.down = 5
  n.fight = 0
  n.punchT = -1
  n.hp = n.role === 'bouncer' ? 4 : 2
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
  freezeLoop(n)
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
    if (n.x === undefined) continue
    const d = Math.hypot(n.x + n.ox - x, n.z + n.oz - z)
    if (d < bestD) {
      best = n
      bestD = d
    }
  }
  return best
}

function walkToward(n, tx, tz, speed, dt) {
  const dx = tx - n.x
  const dz = tz - n.z
  const d = Math.hypot(dx, dz)
  if (d < 0.05) return d
  const step = Math.min(d, speed * dt)
  n.x += (dx / d) * step
  n.z += (dz / d) * step
  n.yaw += wrap(Math.atan2(dx, dz) - n.yaw) * Math.min(1, dt * 8)
  n.moving = true
  return d
}

// focus: where the player is. car: { x, z, yaw, speed, half } when driving, else null.
// Returns the positions of NPCs the car knocked down this frame. NPC punches
// that land on the player are pushed to `events`.
export function updatePedestrians(dt, focus, car, playerOnFoot, events = []) {
  const hits = []
  for (const n of npcs) {
    const dx = (n.x ?? 0) - focus.x
    const dz = (n.z ?? 0) - focus.z
    const far = dx * dx + dz * dz > 160 * 160
    if (far && n.kind !== 'walk') continue
    n.flinch = Math.max(0, n.flinch - dt)

    if (n.down > 0) {
      n.down -= dt
      n.x += n.vx * dt
      n.z += n.vz * dt
      const drag = Math.exp(-3 * dt)
      n.vx *= drag
      n.vz *= drag
      continue
    }
    n.panic = Math.max(0, n.panic - dt)
    n.moving = false

    if (n.fight > 0 && playerOnFoot) {
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
