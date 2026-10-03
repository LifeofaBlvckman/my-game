import { BLOCK, city } from './cityData'
import { bark, yelp } from './audio'

// Street dogs. Each one keeps to the pavement around one block, trotting,
// stopping to sniff, sitting down for a bit. They bark at you if you come
// close, and yelp and run if you punch one or clip it with a car. Only a
// handful exist, kept near the player.

const COUNT = 5
const RING = BLOCK / 2 - 1.6 // the pavement loop around a block's edge
const SIDE = RING * 2
const LOOP = SIDE * 4
const FAR = 140

const blocks = city.blocks.filter((b) => b.w === BLOCK && b.d === BLOCK && !city.parks.some((p) => p.x === b.x && p.z === b.z))
let seed = 99
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

export const COATS = ['#c58a4a', '#3a2c22', '#e8dcc4', '#8a5a2e', '#d9b27a', '#2a2a2a', '#b5793e']
export const dogs = []

// Where along the loop `s` is, and which way that faces.
function ringPoint(b, s) {
  s = ((s % LOOP) + LOOP) % LOOP
  const side = Math.floor(s / SIDE)
  const t = s - side * SIDE - RING
  if (side === 0) return { x: b.x + t, z: b.z - RING, yaw: Math.PI / 2 }
  if (side === 1) return { x: b.x + RING, z: b.z + t, yaw: 0 }
  if (side === 2) return { x: b.x - t, z: b.z + RING, yaw: -Math.PI / 2 }
  return { x: b.x - RING, z: b.z - t, yaw: Math.PI }
}

function place(dog, focus, min, max) {
  const near = blocks.filter((b) => {
    const d = Math.hypot(b.x - focus.x, b.z - focus.z)
    return d > min && d < max
  })
  const list = near.length ? near : blocks
  dog.block = list[Math.floor(rand() * list.length)]
  dog.s = rand() * LOOP
  dog.dir = rand() < 0.5 ? 1 : -1
  dog.state = 'trot'
  dog.timer = 2 + rand() * 6
  dog.flee = 0
  dog.barkAt = 0
  Object.assign(dog, ringPoint(dog.block, dog.s))
}

export function initDogs(focus) {
  for (let k = 0; k < COUNT; k++) {
    const dog = { coat: COATS[k % COATS.length], size: 0.8 + rand() * 0.45, phase: rand() * 6, wag: rand() * 6, head: 0 }
    place(dog, focus, 10, 120)
    dogs.push(dog)
  }
}

export function updateDogs(dt, focus, listener, playerCar) {
  for (const dog of dogs) {
    const dx = focus.x - dog.x
    const dz = focus.z - dog.z
    const d = Math.hypot(dx, dz)
    if (d > FAR) place(dog, focus, 50, 115)

    // Hit by your car: yelp and bolt.
    if (playerCar && playerCar.speed > 4 && Math.hypot(playerCar.x - dog.x, playerCar.z - dog.z) < 2) scare(dog, listener)

    let speed = 0
    if (dog.flee > 0) {
      dog.flee -= dt
      speed = 6
    } else if (d < 7 && !playerCar) {
      // Someone close by: stand and bark at them now and then.
      dog.state = 'bark'
      if (performance.now() > dog.barkAt) {
        dog.barkAt = performance.now() + 1400 + Math.random() * 2500
        bark(Math.max(0, 1 - Math.hypot(listener.x - dog.x, listener.z - dog.z) / 40))
        dog.barking = 0.35
      }
    } else {
      if (dog.state === 'bark') dog.state = 'trot'
      dog.timer -= dt
      if (dog.timer <= 0) {
        // Trot on, stop to sniff, or sit a while; sometimes turn around.
        const r = Math.random()
        dog.state = r < 0.55 ? 'trot' : r < 0.85 ? 'sniff' : 'sit'
        dog.timer = dog.state === 'trot' ? 3 + Math.random() * 8 : 2 + Math.random() * 4
        if (Math.random() < 0.3) dog.dir *= -1
      }
      if (dog.state === 'trot') speed = 1.7 * dog.size
    }
    dog.barking = Math.max(0, (dog.barking ?? 0) - dt)
    dog.s += dog.dir * speed * dt
    const p = ringPoint(dog.block, dog.s)
    dog.x = p.x
    dog.z = p.z
    let want = dog.dir > 0 ? p.yaw : p.yaw + Math.PI
    if (dog.state === 'bark' && dog.flee <= 0) want = Math.atan2(dx, dz)
    dog.yaw = (dog.yaw ?? want) + Math.atan2(Math.sin(want - (dog.yaw ?? want)), Math.cos(want - (dog.yaw ?? want))) * Math.min(1, dt * 8)
    dog.speed = speed
    dog.phase += dt * speed * 5.5
    dog.wag += dt * (dog.state === 'bark' ? 14 : dog.flee > 0 ? 0 : 9)
  }
}

function scare(dog, listener) {
  if (dog.flee > 0) return
  dog.flee = 4
  dog.state = 'trot'
  dog.dir *= -1
  yelp(Math.max(0, 1 - Math.hypot(listener.x - dog.x, listener.z - dog.z) / 40))
}

// A punch landing at (x, z): did it catch a dog?
export function punchDogs(x, z, listener) {
  for (const dog of dogs) {
    if (Math.hypot(dog.x - x, dog.z - z) < 1.1) {
      scare(dog, listener)
      return true
    }
  }
  return false
}
