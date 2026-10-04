import { fx } from './particles'
import { driverGetsOut, knockDown, npcs } from './crowd'
import { TRAFFIC_HP, vehicles } from './trafficSim'
import { claimVehicle } from './worldSync'
import { VEHICLES } from './vehicleTypes'
import { boom, crashSound, thud } from './audio'
import { useGame, world } from './state'

// Health and damage for the player, the player's car and traffic. Kept apart
// from the systems themselves so anything (punches, crashes, explosions,
// other players) can hurt anything else.

export { TRAFFIC_HP }
export const CAR_HP = 100
const BURN_TIME = 4 // seconds a car burns before it blows up

let hurtKey = 0

export function hurtPlayer(amount, fromX, fromZ, knock = false) {
  const game = useGame.getState()
  if (game.phase !== 'playing' || game.busted || game.wasted || amount <= 0) return
  world.lastHurt = performance.now()
  const health = Math.max(0, game.health - amount)
  useGame.setState({ health, hurt: ++hurtKey })
  fx.shake(Math.min(0.6, amount / 40))
  if (game.mode === 'foot' && world.player) {
    const p = world.player.translation()
    fx.pow(p.x, p.y + 1.4, p.z, amount >= 15 ? 'OOF!' : undefined)
    world.flinch = 0.4
    if (knock || amount >= 18) {
      world.playerDown = 1.6
      const dx = p.x - (fromX ?? p.x)
      const dz = p.z - (fromZ ?? p.z)
      const d = Math.hypot(dx, dz) || 1
      world.player.setLinvel({ x: (dx / d) * 6, y: 5, z: (dz / d) * 6 }, true)
    }
  }
  if (health <= 0) world.events.push({ type: 'wasted' })
}

// --- The player's car ---

export function damagePlayerCar(amount) {
  if (world.carWrecked || amount <= 0) return
  world.carHp = Math.max(0, (world.carHp ?? CAR_HP) - amount)
  if (world.carHp <= 0 && !world.carBurning) world.carBurning = BURN_TIME
}

// --- Traffic ---

const occupied = (v) => v.state !== 'parked' && !v.wrecked && !(v.burning > 0) && !v.officerOut

// Damage a traffic vehicle. A hard enough knock can bring the driver out to
// argue (and sometimes fight); a fire always gets them out.
export function damageVehicle(v, amount, impact = 0) {
  if (v.wrecked || amount <= 0 || v.away) return
  // Online: whoever hits a car runs it from now on (worldSync.js).
  claimVehicle(v)
  v.hp = (v.hp ?? TRAFFIC_HP) - amount
  v.stall = Math.max(v.stall ?? 0, 2.5)
  if (v.hp <= 0 && !v.burning) {
    if (occupied(v) && !v.police) driverGetsOut(v.x, v.z, v.yaw, world.focus, 'flee')
    v.burning = BURN_TIME
    v.speed = 0
    v.state = 'parked'
    v.chasing = false
  } else if (impact > 9 && occupied(v) && !v.police && Math.random() < 0.45) {
    if (driverGetsOut(v.x, v.z, v.yaw, world.focus, Math.random() < 0.6 ? 'fight' : 'flee')) {
      v.state = 'parked' // they left it where it is
      v.speed = 0
    }
  }
}

export function wreckVehicle(v) {
  v.wrecked = true
  v.burning = 0
  v.state = 'parked'
  v.chasing = false
  v.police = false
  v.color = '#2b2626'
  v.dirty = true
  v.speed = 0
}

// Smoke when damaged, flames when it's about to go. Call once per frame.
export function vehicleSmoke(x, y, z, hp, maxHp, burning, dt) {
  const r = Math.random()
  if (burning > 0) {
    if (r < dt * 30) fx.fire(x, y, z, 0.6)
    if (r < dt * 10) fx.smoke(x, y + 0.6, z, true, 0.8)
  } else if (hp < maxHp * 0.25) {
    if (r < dt * 12) fx.smoke(x, y, z, true)
    if (r < dt * 4) fx.fire(x, y, z, 0.35)
  } else if (hp < maxHp * 0.55) {
    if (r < dt * 6) fx.smoke(x, y, z, false, 0.45)
  }
}

// --- Explosions ---

export function explode(x, z, source) {
  fx.explosion(x, 0.5, z)
  boom()
  for (const n of npcs) {
    if (n.x === undefined || n.away) continue
    const d = Math.hypot(n.x - x, n.z - z)
    if (d < 9) knockDown(n, n.x - x, n.z - z, 12 - d)
  }
  for (const v of vehicles) {
    if (v === source) continue
    const d = Math.hypot(v.x - x, v.z - z)
    if (d < 7) damageVehicle(v, 45 * (1 - d / 7))
  }
  if (world.car && source !== 'playerCar') {
    const c = world.car.translation()
    const d = Math.hypot(c.x - x, c.z - z)
    if (d < 7) damagePlayerCar(60 * (1 - d / 7))
  }
  const d = Math.hypot(world.focus.x - x, world.focus.z - z)
  if (d < 8) hurtPlayer(Math.round(60 * (1 - d / 8)), x, z, true)
  world.events.push({ type: 'explosion', x, z })
}

// Crash between the player's car and something solid.
export function crash(x, y, z, impact, color) {
  fx.sparks(x, y, z, Math.round(8 + impact * 1.5))
  fx.debris(x, y, z, color, Math.round(3 + impact / 3))
  fx.dust(x, 0.2, z, 4)
  fx.shake(Math.min(1, impact / 25))
  if (impact > 18) fx.pow(x, y + 1.5, z, 'KRASH!')
  crashSound(impact / 20)
  thud()
}

export const vehicleHalf = (type) => VEHICLES[type].half
