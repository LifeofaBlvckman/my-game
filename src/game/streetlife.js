import { city, onBanana } from './cityData'
import { npcs } from './crowd'
import { claimNpc, runsNpc } from './worldSync'
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

// --- Banana Island: the gate and estate security ---
// The estate is residents only. The boom stays down for anyone who doesn't
// own the mansion, unless they "settle" the guards at the gate. Get in some
// other way (swim round the sea wall) and the guards come running; when one
// catches you, settle him on the spot or get thrown out at the gate.

const GATE_NEAR = 16
export const PASS_FEE = 3000 // the gate guards, to lift the boom
export const CATCH_FEE = 5000 // the guard who caught you
const PASS_TIME = 180 // seconds a settled pass lasts
const THROW_OUT_AFTER = 7 // seconds held before they march you out
let gateGreeted = false
const estate = { alarm: 0, held: 0, warned: false }

const resident = (game) => game.properties.includes('mansion')
const hasPass = (game) => (game.estatePass ?? 0) > Date.now()
const guards = () => npcs.filter((n) => n.role === 'guard' && n.active !== false && !(n.down > 0))

function calmGuards() {
  for (const n of npcs) {
    if (n.role !== 'guard') continue
    n.chasePlayer = false
    n.grab = false
  }
  estate.alarm = 0
  estate.held = 0
  estate.warned = false
  world.guardHold = false
}

// What E does near the gate or in a guard's grip (GameLogic shows the prompt).
export function estateOffer() {
  if (world.guardHold) return { kind: 'catch', fee: CATCH_FEE }
  if (world.gateOffer) return { kind: 'gate', fee: PASS_FEE }
  return null
}

export function settleEstate() {
  const offer = estateOffer()
  if (!offer) return false
  const game = useGame.getState()
  if (game.money < offer.fee) {
    message(`YOU NEED ${naira(offer.fee)}`, '#ff6b6b', 2200)
    if (offer.kind === 'catch') throwOut()
    return true
  }
  useGame.setState({ money: game.money - offer.fee, estatePass: Date.now() + PASS_TIME * 1000 })
  jingle()
  if (offer.kind === 'gate') say('Estate guard', 'Ehen! {Oga|Madam}, you be correct person. We go open for you.', 3000)
  else say('Estate guard', 'Ah, no wahala. Enjoy yourself, but no cause trouble for here o.', 3200)
  message(`ESTATE PASS\n${naira(offer.fee)} · 3 MIN`, '#e0c35a', 2600)
  calmGuards()
  return true
}

function throwOut() {
  const g = city.bananaIsland?.gate
  calmGuards()
  if (!g) return
  hooks.place?.(g.x + 14, g.z, -Math.PI / 2)
  hooks.hurt?.(8)
  say('Estate guard', 'Comot for here! Next time we go call police.', 3000)
  message('THROWN OUT OF\nBANANA ISLAND', '#ff6b6b', 3000)
}

// GameLogic gives us a way to move and hurt the player.
const hooks = {}
export const setEstateHooks = (h) => Object.assign(hooks, h)

export function updateEstateGate(game, focus, dt = 1 / 60) {
  const g = city.bananaIsland?.gate
  if (!g) return
  const allowed = resident(game) || hasPass(game)
  if (!allowed && (game.estatePass ?? 0) > 0) useGame.setState({ estatePass: 0 }) // the pass ran out
  const near = !game.inside && Math.abs(focus.z - g.z) < 12 && Math.abs(focus.x - g.x) < GATE_NEAR
  world.gateOpen = allowed && near
  // Standing at the boom, outside: the guards can be persuaded.
  world.gateOffer = !allowed && near && focus.x > g.x && game.mode === 'foot'
  if (!near) {
    if (Math.abs(focus.x - g.x) > GATE_NEAR + 10 || Math.abs(focus.z - g.z) > 30) gateGreeted = false
  } else if (!gateGreeted) {
    gateGreeted = true
    if (resident(game)) say('Estate guard', 'Welcome home, {oga|madam}! Opening the gate.', 2800)
    else if (allowed) say('Estate guard', 'Pass, pass. You don settle us already.', 2400)
    else if (focus.x > g.x) {
      whistle()
      say('Estate guard', 'Oga, this is a private estate. Residents only! Unless... you wan settle us?', 3800)
      message('BANANA ISLAND\nRESIDENTS ONLY', '#e0c35a', 2500)
    }
  }

  // Inside the estate without the right: security comes for you.
  const trespassing = !game.inside && !allowed && onBanana(focus.x, focus.z) && focus.x < g.x - 2
  if (!trespassing) {
    if (estate.warned || world.guardHold) calmGuards()
    return
  }
  estate.alarm += dt
  if (!estate.warned) {
    estate.warned = true
    whistle()
    say('Estate guard', 'Hey! You! Who let you into this estate? Stop there!', 3200)
    message('TRESPASSING\nESTATE SECURITY IS COMING', '#ff6b6b', 2800)
  }
  const list = guards()
  if (estate.alarm > 0.8) for (const n of list) if (Math.hypot(n.x - focus.x, n.z - focus.z) < 160) n.chasePlayer = true
  const holding = game.mode === 'foot' && list.some((n) => n.chasePlayer && n.grab)
  if (holding) {
    if (!world.guardHold) {
      world.guardHold = true
      say('Estate guard', 'Oya! I don catch you. Settle me now, or I throw you out!', 3500)
    }
    estate.held += dt
    if (estate.held > THROW_OUT_AFTER) throwOut()
  } else if (world.guardHold) {
    world.guardHold = false
    estate.held = 0
  }
}

// --- Life on the street ---
// Now and then two people near you start fighting and a crowd gathers round
// to watch (and shout). Hawkers call out their goods, preachers preach,
// people gisting on the pavement can be overheard, and anyone you barge
// into or walk past might say something.

const BRAWL_EVERY = [70, 130] // seconds between street fights
let brawlIn = 40
const SHOUTS = ['Fight! Fight! Fight!', 'Leave am! Leave am!', 'Na so una go dey fight for road?', 'Hold am! Hold am o!', 'Wahala dey o! Somebody separate them!', 'Na who start am?']
const KO_LINES = ['Ehen! E don finish!', 'Somebody carry am go hospital!', 'Una don see am? Na im start am.']

export function startStreetFight(focus) {
  const free = (n) => n.kind === 'walk' && runsNpc(n) && n.x !== undefined && !(n.down > 0) && !(n.panic > 0) && !n.brawlWith && !(n.fight > 0)
  const pool = npcs.filter((n) => free(n) && Math.hypot(n.x - focus.x, n.z - focus.z) > 12 && Math.hypot(n.x - focus.x, n.z - focus.z) < 45)
  for (const a of pool) {
    const b = pool.find((o) => o !== a && Math.hypot(o.x - a.x, o.z - a.z) < 9)
    if (!b) continue
    const time = 12 + Math.random() * 6
    for (const [p, q] of [
      [a, b],
      [b, a],
    ]) {
      claimNpc(p)
      p.brawlWith = q
      p.brawlT = time
      p.brawlHp = 3 + Math.floor(Math.random() * 3)
      p.punchCooldown = Math.random()
    }
    // A ring of people gathers to watch.
    const cx = (a.x + b.x) / 2
    const cz = (a.z + b.z) / 2
    const until = performance.now() + (time + 3) * 1000
    const crowd = npcs.filter((n) => free(n) && n !== a && n !== b && Math.hypot(n.x - cx, n.z - cz) < 28).slice(0, 7)
    crowd.forEach((n, k) => {
      claimNpc(n)
      const ang = (k / crowd.length) * Math.PI * 2
      n.watching = { x: cx + Math.sin(ang) * 3.4, z: cz + Math.cos(ang) * 3.4, cx, cz, until }
    })
    if (Math.hypot(cx - focus.x, cz - focus.z) < 45) say('Crowd', SHOUTS[Math.floor(Math.random() * SHOUTS.length)], 2600)
    return true
  }
  return false
}

const HAWKER_LINES = ['Gala! Gala! Buy your Gala!', 'Pure water! Cold pure water, ₦20!', 'Plantain chips! Buy one, oga!', 'Gala and Lacasera! Come buy!', 'Puff-puff! Fresh puff-puff!']
const SERMON = ['Repent! The kingdom of God is at hand!', 'Brothers and sisters, this Lagos no be your home. Heaven is your home!', 'Whatever you are going through, God will see you through! Say Amen!', 'Somebody shout Hallelujah!', 'Stop chasing money, chase God! The money go follow!']
const GIST = ['...I tell am say na fuel price, e no hear word.', '...dem say NEPA go bring light this evening, I no believe.', '...my brother, this Lagos traffic go kill person.', '...you see that Super Eagles match? Wonderful!', '...she don travel to London, she no even call me.', '...landlord don increase rent again o!', '...na God dey run this country, no be them.']
const BUMP = ['Ehn! Watch where you dey go!', 'Are you blind? Mtcheew!', 'Oga, gently! This road no be your own.', 'Sorry o! Ah, no be me jam you.', 'Abeg, take am easy!']
const GREET = ['Bros, how far?', 'Good afternoon, {sir|ma}!', 'Omo, you fresh o!', 'Big {man|woman}! Wetin you carry for me?', 'How body?']

let lineIn = 0
const quiet = () => {
  const g = useGame.getState()
  return !g.subtitle && !g.dialogue && !g.inside && g.phase === 'playing'
}
const oneOf = pick

export function streetEvent(e) {
  if (e.type === 'bump' && quiet()) say(e.npc.role === 'hawker' ? 'Hawker' : 'Passer-by', oneOf(BUMP), 2200)
  else if (e.type === 'brawlKO' && quiet() && Math.hypot(e.x - world.focus.x, e.z - world.focus.z) < 40) say('Crowd', oneOf(KO_LINES), 2400)
}

export function updateStreetLife(dt, game, focus) {
  if (game.inside || game.phase !== 'playing') return
  brawlIn -= dt
  if (brawlIn <= 0) brawlIn = startStreetFight(focus) ? BRAWL_EVERY[0] + Math.random() * (BRAWL_EVERY[1] - BRAWL_EVERY[0]) : 10
  lineIn -= dt
  if (lineIn > 0 || !quiet() || game.mode !== 'foot') return
  // Whoever is closest and has something to say.
  let best = null
  let bestD = Infinity
  for (const n of npcs) {
    if (n.x === undefined || n.active === false || n.away || n.down > 0 || n.fight > 0) continue
    const d = Math.hypot(n.x - focus.x, n.z - focus.z)
    const range = n.role === 'preacher' ? 9 : n.role === 'hawker' ? 5 : n.role === 'chat' ? 3.5 : 2.4
    if (d < range && d < bestD) {
      best = n
      bestD = d
    }
  }
  if (!best) return
  if (best.role === 'preacher') say('Preacher', oneOf(SERMON), 3600)
  else if (best.role === 'hawker') say('Hawker', oneOf(HAWKER_LINES), 2600)
  else if (best.role === 'chat') say('Someone gisting', oneOf(GIST), 3200)
  else if (best.kind === 'walk' && Math.random() < 0.25) say('Passer-by', oneOf(GREET), 2200)
  else {
    lineIn = 2
    return
  }
  lineIn = best.role === 'preacher' ? 6 : 9
}
