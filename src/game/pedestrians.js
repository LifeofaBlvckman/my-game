import { BLOCK, city, mulberry32, SIDEWALK_Y } from './cityData'
import { lookFromSeed, randomLook } from './people'

// Crowd simulation. Plain objects updated every frame; Pedestrians.jsx draws them.
const WALKERS = 70
const RECYCLE = 140

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
      ? lookFromSeed(900 + k, { female: false, top: '#111111', bottom: '#111111', hair: 'bald', face: 1, skin: '#4f2f1c', robe: false, height: 1.15 })
      : spot.role === 'trader'
        ? randomLook(rand, { robe: true })
        : randomLook(rand)
  npcs.push({ kind: 'idle', look, x: spot.x, z: spot.z, y: spot.y, yaw: spot.yaw, role: spot.role })
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
  n.down = 0 // seconds left lying on the ground after being hit
  n.panic = 0
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

// focus: where the player is. car: { x, z, yaw, speed, half } when driving, else null.
// Returns how many NPCs the car knocked down this frame.
export function updatePedestrians(dt, focus, car, playerOnFoot) {
  let hits = 0
  for (const n of npcs) {
    const dx = (n.x ?? 0) - focus.x
    const dz = (n.z ?? 0) - focus.z
    const far = dx * dx + dz * dz > 160 * 160
    if (far && n.kind !== 'walk') continue

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
    const pace = n.panic > 0 ? 3.2 : 1

    if (n.kind === 'walk') {
      if (far) {
        if (dx * dx + dz * dz > RECYCLE * RECYCLE) placeWalker(n, focus)
      }
      n.t += n.dir * n.speed * pace * dt
      const p = loopPoint(n)
      n.x = p.x
      n.z = p.z
      n.yaw += wrap(p.yaw - n.yaw) * Math.min(1, dt * 8)
      n.moving = true
    } else if (n.kind === 'wander') {
      if (n.pause > 0) {
        n.pause -= dt * pace
        n.moving = false
        if (n.pause <= 0) {
          n.tx = n.area.x + (Math.random() - 0.5) * n.area.w
          n.tz = n.area.z + (Math.random() - 0.5) * n.area.d
        }
      } else {
        const tx = n.tx - n.x
        const tz = n.tz - n.z
        const d = Math.hypot(tx, tz)
        if (d < 0.3) {
          n.pause = 1 + Math.random() * 4
        } else {
          const step = Math.min(d, n.speed * pace * dt)
          n.x += (tx / d) * step
          n.z += (tz / d) * step
          n.yaw += wrap(Math.atan2(tx, tz) - n.yaw) * Math.min(1, dt * 6)
          n.moving = true
        }
      }
    } else {
      n.moving = false
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
        knockDown(n, rx, rz, Math.abs(car.speed))
        hits++
      }
    }
  }
  return hits
}

function knockDown(n, rx, rz, speed) {
  if (n.kind === 'walk') {
    // Freeze the loop position into a plain position while lying down.
    const p = loopPoint(n)
    n.x = p.x
    n.z = p.z
  }
  const d = Math.hypot(rx, rz) || 1
  n.vx = (rx / d) * Math.min(10, speed * 0.5)
  n.vz = (rz / d) * Math.min(10, speed * 0.5)
  n.down = 5
  n.yaw = Math.atan2(-rx, -rz) // fall away from the car
  for (const o of npcs) {
    if (o !== n && o.x !== undefined && Math.hypot(o.x - n.x, o.z - n.z) < 20) o.panic = 6
  }
}
