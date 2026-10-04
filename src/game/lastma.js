import { summonLastma } from './trafficSim'
import { bust, jingle, whistle } from './audio'
import { message, naira, say } from './notify'
import { useGame, world } from './state'

// Run a red light in front of a LASTMA warden and you don't get a police
// star: a LASTMA patrol pickup comes after you instead. If it catches you
// (pulls up on you while you're slow or stopped) you pay a fine on the spot;
// get far enough away for long enough and they give up.

export const FINE = 5000
const CATCH_RANGE = 8
const CATCH_TIME = 1.6 // seconds alongside you while you're slow
const LOSE_RANGE = 110
const LOSE_TIME = 8
const GIVE_UP = 75 // seconds of chasing at most

export const lastma = { v: null, t: 0, near: 0, far: 0 }

export function startLastma(focus) {
  if (lastma.v) return
  const v = summonLastma(focus)
  if (!v) return
  Object.assign(lastma, { v, t: 0, near: 0, far: 0 })
  whistle()
  message('LASTMA SAW YOU RUN THE RED LIGHT!\nTHEY ARE COMING FOR YOU', '#ffb31a', 3200)
  useGame.setState({ lastma: true })
}

function stop() {
  if (lastma.v) lastma.v.lastmaOn = false
  lastma.v = null
  useGame.setState({ lastma: false })
}

export function updateLastma(dt, game, focus) {
  const v = lastma.v
  if (!v) return
  // Wrecked, swapped into your hands, or you went indoors: it's over.
  if (v.type !== 'lastma' || v.state === 'parked' || v.wrecked || v.burning > 0 || game.inside || game.wasted || game.busted) return stop()
  lastma.t += dt
  const d = Math.hypot(v.x - focus.x, v.z - focus.z)
  const speed = game.mode === 'car' ? Math.abs(world.carSpeed ?? 0) : Math.hypot(world.player?.linvel().x ?? 0, world.player?.linvel().z ?? 0)
  lastma.near = d < CATCH_RANGE && speed < 4 ? lastma.near + dt : Math.max(0, lastma.near - dt)
  lastma.far = d > LOSE_RANGE ? lastma.far + dt : 0
  if (lastma.near > CATCH_TIME) {
    const fine = Math.min(FINE, game.money)
    useGame.setState({ money: game.money - fine })
    bust()
    say('LASTMA Officer', fine < FINE ? '{Oga|Madam}, you beat red light! Oya, bring everything wey dey your pocket.' : '{Oga|Madam}, you beat red light! Na ₦5,000 fine, or we tow this motor. Pay now now!', 3500)
    message(`LASTMA CAUGHT YOU\nFINE ${naira(fine)}`, '#ff6b6b', 3500)
    return stop()
  }
  if (lastma.far > LOSE_TIME || lastma.t > GIVE_UP) {
    jingle()
    message('YOU LOST LASTMA', '#7cff9a', 2500)
    return stop()
  }
}
