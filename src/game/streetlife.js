import { city } from './cityData'
import { npcs } from './crowd'
import { jingle, whistle } from './audio'
import { message, naira, say } from './notify'
import { useGame, world } from './state'

// Trouble on the street that isn't the police: area boys who want to be
// "settled", and soldiers who don't want anyone in their barracks.

// --- Area boys ---
// Walk past a gang and the leader stops you: pay up (E), or walk away and
// they come after you. Punch one and the whole gang joins in. Knock them all
// down and they scatter, dropping their takings.

export const SETTLE = 500
const ASK_RANGE = 4.5
const ASK_TIME = 9 // seconds to pay before they lose patience
const LEAVE_RANGE = 13 // walking off this far means "no"
const SETTLED_FOR = 180 // seconds they leave you alone after you pay
const LOOT = 800

const DEMANDS = [
  '{Oga|Madam}! Settle the boys now. {name}, na ₦500 we dey collect.',
  'Ehen! {Bros|Sister}, where our own? Drop ₦500 for the boys.',
  'This corner na our office. ₦500 to pass, {my guy|fine girl}.',
]
const THANKS = ['Correct {guy|babe}! Waka well.', 'Baba God bless you! Nobody go touch you for this area.', 'You don hear word. Go in peace.']
const THREATS = ['You wan run? Boys, deal with am!', 'You no fit settle? We go collect am by force!']

export const gangs = (city.gangs ?? []).map((g) => ({ ...g, members: npcs.filter((n) => n.gang === g.id), state: 'idle', t: 0, calmUntil: 0 }))

const pick = (list) => list[Math.floor(Math.random() * list.length)]
const now = () => performance.now() / 1000

function startFight(g, line) {
  g.state = 'fight'
  for (const n of g.members) {
    n.demanding = false
    if (n.down <= 0) n.fight = 16
  }
  if (line) say('Area boy', line)
}

// The gang that's asking you for money right now, if any.
export const gangAsking = () => gangs.find((g) => g.state === 'ask')

export function settleGang() {
  const g = gangAsking()
  if (!g) return false
  const game = useGame.getState()
  if (game.money < SETTLE) {
    startFight(g, "No money? Then we go collect your phone! Boys!")
    return true
  }
  useGame.setState({ money: game.money - SETTLE })
  g.state = 'idle'
  g.calmUntil = now() + SETTLED_FOR
  for (const n of g.members) n.demanding = false
  say('Area boy', pick(THANKS))
  return true
}

export function updateAreaBoys(dt, game, focus) {
  const onFoot = game.mode === 'foot' && !game.inside && !game.wasted && !game.busted
  for (const g of gangs) {
    const d = Math.hypot(focus.x - g.x, focus.z - g.z)
    const lead = g.members.find((n) => n.lead) ?? g.members[0]
    if (!lead) continue
    // Someone punched one of them: all of them get involved.
    if (g.state !== 'fight' && g.members.some((n) => n.fight > 0)) startFight(g)

    if (g.state === 'idle') {
      if (onFoot && d < ASK_RANGE && now() > g.calmUntil && !game.dialogue && game.wanted === 0) {
        g.state = 'ask'
        g.t = ASK_TIME
        for (const n of g.members) n.demanding = true
        say('Area boy', pick(DEMANDS), 4000)
      }
    } else if (g.state === 'ask') {
      g.t -= dt
      // Stand in your way and stare you down.
      for (const n of g.members) if (n.down <= 0) n.yaw = Math.atan2(focus.x - n.x, focus.z - n.z)
      if (!onFoot || game.wanted > 0) {
        // Drove off, went inside, or the police turned up.
        g.state = 'idle'
        g.calmUntil = now() + 20
        for (const n of g.members) n.demanding = false
      } else if (g.t <= 0 || d > LEAVE_RANGE) {
        startFight(g, pick(THREATS))
      }
    } else if (g.state === 'fight') {
      const standing = g.members.filter((n) => n.down <= 0)
      if (!standing.length) {
        // All of them on the floor: they scatter and leave their money.
        g.state = 'idle'
        g.calmUntil = now() + 240
        for (const n of g.members) {
          n.fight = 0
          n.afterDown = 'panic'
        }
        useGame.setState({ money: useGame.getState().money + LOOT })
        jingle()
        message(`AREA BOYS SCATTER!\n+${naira(LOOT)}`, '#7ee07e', 3000)
      } else if (standing.every((n) => n.fight <= 0)) {
        // They gave up (you got away).
        g.state = 'idle'
        g.calmUntil = now() + 60
      }
    }
  }
}

// --- The barracks ---
// Walk or drive in past the gate and the soldiers warn you once; stay and
// they come for you, and the police are called.

const WARN_TIME = 5
const b = city.barracks
let warned = 0 // seconds inside since the warning
let alerted = false

export const inBarracks = (p) => !!b && Math.abs(p.x - b.x) < b.half - 0.3 && Math.abs(p.z - b.z) < b.half - 0.3

export function updateBarracks(dt, game, focus, addWanted) {
  if (!b) return
  const inside = !game.inside && inBarracks(focus)
  if (!inside) {
    warned = Math.max(0, warned - dt * 0.5)
    if (warned === 0) alerted = false
    return
  }
  if (warned === 0) {
    whistle()
    say('Soldier', 'HALT! This is a military zone, {oga|madam}. Turn back NOW!', 3500)
    message('MILITARY ZONE\nLEAVE NOW', '#ff6b6b', 2500)
  }
  warned += dt
  if (warned > WARN_TIME && !alerted) {
    alerted = true
    say('Soldier', 'You no hear word? Arrest that {man|woman}!', 3000)
    addWanted(2)
    for (const n of npcs) if (n.role === 'soldier' && !n.lookout && Math.hypot(n.x - focus.x, n.z - focus.z) < 45) n.fight = 20
  }
  // Soldiers who are already after you keep coming while you stay.
  if (alerted && game.mode === 'foot') for (const n of npcs) if (n.role === 'soldier' && !n.lookout && n.fight > 0 && n.fight < 4) n.fight = 8
  world.trespass = alerted
}

// --- Banana Island gate ---
// The estate is residents only. The boom stays down and the guards turn you
// back unless you own the mansion; then it lifts as you come up to it.

const GATE_NEAR = 16
let gateGreeted = false

export function updateEstateGate(game, focus) {
  const g = city.bananaIsland?.gate
  if (!g) return
  const resident = game.properties.includes('mansion')
  const near = !game.inside && Math.abs(focus.z - g.z) < 12 && Math.abs(focus.x - g.x) < GATE_NEAR
  world.gateOpen = resident && near
  if (!near) {
    if (Math.abs(focus.x - g.x) > GATE_NEAR + 10 || Math.abs(focus.z - g.z) > 30) gateGreeted = false
    return
  }
  if (gateGreeted) return
  gateGreeted = true
  if (resident) say('Estate guard', 'Welcome home, {oga|madam}! Opening the gate.', 2800)
  else if (focus.x > g.x) {
    whistle()
    say('Estate guard', 'Oga, this is a private estate. Residents only, no entry!', 3500)
    message('BANANA ISLAND\nRESIDENTS ONLY', '#e0c35a', 2500)
  }
}
