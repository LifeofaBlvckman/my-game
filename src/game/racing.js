import { BEACH, ISLAND, ISLAND_FIRST, MAINLAND, roadX, roadZ } from './cityData'
import { useGame, world } from './state'

// Races you can run with other players online (or alone, against the
// clock). Walk or drive to a start flag on the Island and press E: everyone
// in your room gets 20 seconds to join, then the server starts the race.
// First across the line wins the big prize.

const junction = (i, j) => ({ x: roadX(ISLAND_FIRST + i), z: roadZ(j) })
const beachZ = MAINLAND.maxZ + BEACH / 2

export const RACES = {
  street: {
    id: 'street',
    name: 'Island Street Race',
    vehicle: true,
    // Start on the road beside the flag, facing east.
    start: { x: (junction(1, 4).x + junction(2, 4).x) / 2, z: roadZ(4) + 3, yaw: Math.PI / 2 },
    checkpoints: [junction(3, 4), junction(3, 1), junction(5, 1), junction(5, 7), junction(1, 7), junction(1, 4), { x: (junction(1, 4).x + junction(2, 4).x) / 2 + 6, z: roadZ(4) + 3 }],
    par: 75, // seconds; beat it alone for the full solo prize
    prizes: [20000, 10000, 5000],
  },
  beach: {
    id: 'beach',
    name: 'Bar Beach Sprint',
    vehicle: false,
    start: { x: ISLAND.minX + 14, z: beachZ, yaw: Math.PI / 2 },
    checkpoints: Array.from({ length: 6 }, (_, k) => ({ x: ISLAND.minX + 54 + k * 38, z: beachZ + (k % 2 ? 6 : -6) })),
    par: 30,
    prizes: [8000, 4000, 2000],
  },
}
const LOBBY = 20 // seconds to join (the server's LOBBY_MS)
const GRID = 3 // seconds on the start line before GO
const SOLO_PRIZE = 0.5 // share of first prize for a solo run under par
const flagSpot = (race) => ({ x: race.start.x, z: race.start.z })

// Things races need from the rest of the game (wired up by GameLogic).
let hooks = { message() {}, banner() {}, placeAt() {}, addMoney() {}, chat() {}, sound() {} }
export function setRaceHooks(h) {
  hooks = { ...hooks, ...h }
}

// world.race: { id, phase: 'lobby' | 'grid' | 'running' | 'done', joined, startsAt, racers, cp, started, online, host }
const now = () => performance.now()
const ordinal = (n) => {
  const teen = n % 100 >= 11 && n % 100 <= 13
  return `${n}${teen ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
}
const clock = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`

function publish() {
  const r = world.race
  if (!r) return useGame.setState({ race: null })
  const def = RACES[r.id]
  const left = Math.max(0, Math.ceil((r.startsAt - now()) / 1000))
  useGame.setState({
    race: {
      name: def.name,
      phase: r.phase,
      joined: r.joined,
      host: r.host,
      left,
      racers: r.racers?.length ?? 1,
      cp: r.cp,
      count: def.checkpoints.length,
      time: r.started ? (now() - r.started) / 1000 : 0,
      place: r.place,
    },
  })
}

export function nearFlag() {
  for (const race of Object.values(RACES)) {
    const f = flagSpot(race)
    if (Math.hypot(f.x - world.focus.x, f.z - world.focus.z) < 9) return race
  }
  return null
}

export function racePrompt() {
  const race = nearFlag()
  if (!race) return null
  const r = world.race
  const inCar = useGame.getState().mode === 'car'
  if (r && r.id !== race.id) return null
  if (r?.joined) return null
  if (race.vehicle && !inCar) return `${race.name}: get in a car, then press E here`
  if (!race.vehicle && inCar) return `${race.name}: get out of the car, then press E here`
  if (r?.phase === 'lobby') return `Press E to join the ${race.name} (${Math.ceil((r.startsAt - now()) / 1000)} s)`
  return `Press E to start the ${race.name}`
}

// E near a flag: open a race, or join the one that's waiting. Returns true if handled.
export function raceInteract() {
  const race = nearFlag()
  const game = useGame.getState()
  if (!race || game.phase !== 'playing' || game.dialogue || game.chatOpen) return false
  if ((race.vehicle && game.mode !== 'car') || (!race.vehicle && game.mode !== 'foot')) return false
  const r = world.race
  if (r && r.id !== race.id) return false
  if (r?.joined) return true
  const net = world.net
  if (r?.phase === 'lobby') {
    r.joined = true
    if (net) net.send({ t: 'race', a: 'join', route: race.id })
    hooks.banner('YOU JOINED THE RACE')
  } else if (!r) {
    if (net) {
      net.send({ t: 'race', a: 'open', route: race.id })
      world.race = { id: race.id, phase: 'lobby', joined: true, startsAt: now() + LOBBY * 1000, racers: [net.id], cp: 0, online: true, host: useGame.getState().playerName }
    } else {
      // Offline: race the clock.
      world.race = { id: race.id, phase: 'lobby', joined: true, startsAt: now() + 4000, racers: [null], cp: 0, online: false }
    }
    hooks.banner(`${race.name.toUpperCase()}`)
  }
  publish()
  return true
}

// Messages from the server about the race in this room.
export function onRaceMessage(msg, myId) {
  const def = RACES[msg.route ?? world.race?.id]
  if (msg.a === 'open') {
    const mine = msg.racers?.includes(myId)
    world.race = { id: msg.route, phase: 'lobby', joined: mine, startsAt: now() + msg.in, racers: msg.racers, cp: 0, online: true, host: msg.host }
    if (!mine) hooks.chat(`${msg.host} started the ${def.name}! Go to the flag on the Island and press E to join (${Math.round(msg.in / 1000)} s).`)
  } else if (msg.a === 'joined' && world.race) {
    world.race.racers = msg.racers
    world.race.startsAt = now() + msg.in
    hooks.chat(`${msg.name} joined the race.`)
  } else if (msg.a === 'go' && world.race) {
    world.race.racers = msg.racers
    if (world.race.joined && msg.racers.includes(myId)) {
      if (world.race.phase !== 'grid') toGrid()
      go()
    } else world.race.phase = 'watching'
  } else if (msg.a === 'result' && world.race) {
    hooks.chat(`🏁 ${msg.name} finished ${ordinal(msg.place)} in ${clock(msg.time)}`)
    if (msg.id === myId) prize(msg.place, msg.time)
  } else if (msg.a === 'end') {
    if (world.race?.phase === 'running') hooks.message('RACE OVER', '#ffd23a', 2500)
    world.race = null
  }
  publish()
}

function toGrid() {
  const r = world.race
  const def = RACES[r.id]
  const slot = Math.max(0, r.racers?.indexOf(world.net?.id ?? null) ?? 0)
  // Line up side by side behind the start, facing along the road.
  const side = (slot % 2 ? 1 : -1) * Math.ceil(slot / 2) * (def.vehicle ? 3.2 : 1.4)
  const back = Math.floor(slot / 2) * (def.vehicle ? 7 : 2)
  const sx = Math.cos(def.start.yaw)
  const sz = -Math.sin(def.start.yaw)
  hooks.placeAt(def.start.x + sx * side - Math.sin(def.start.yaw) * back, def.start.z + sz * side - Math.cos(def.start.yaw) * back, def.start.yaw, def.vehicle)
  r.phase = 'grid'
  world.raceHold = true
}

function go() {
  const r = world.race
  r.phase = 'running'
  r.started = now()
  r.cp = 0
  world.raceHold = false
  hooks.message('GO!', '#7ee07e', 1200)
  hooks.sound('go')
}

function prize(place, time) {
  const def = RACES[world.race.id]
  const solo = (world.race.racers?.length ?? 1) <= 1
  const amount = solo ? (time <= def.par ? Math.round(def.prizes[0] * SOLO_PRIZE) : 1000) : (def.prizes[place - 1] ?? 1000)
  hooks.addMoney(amount)
  world.race.place = place
  world.race.phase = 'done'
  const msg = solo ? (time <= def.par ? `NEW RECORD PACE!\n${clock(time)}` : `FINISHED\n${clock(time)}`) : place === 1 ? 'YOU WON!' : `${ordinal(place).toUpperCase()} PLACE`
  hooks.message(`${msg}\n+₦${amount.toLocaleString('en-NG')}`, place === 1 || solo ? '#7ee07e' : '#ffd23a', 4500)
  hooks.sound('win')
}

// Every frame: countdowns, the start line, checkpoints, the finish.
let lastPublish = 0
let lastBeep = 0
export function updateRace() {
  const r = world.race
  if (!r) return
  const def = RACES[r.id]
  const t = now()
  const game = useGame.getState()
  if (r.phase === 'lobby' && r.joined) {
    // Leave the race by wandering off (or getting out of the car).
    const f = flagSpot(def)
    const wrongMode = def.vehicle ? game.mode !== 'car' : game.mode !== 'foot'
    if (Math.hypot(f.x - world.focus.x, f.z - world.focus.z) > 120 || wrongMode) {
      hooks.message(wrongMode ? (def.vehicle ? 'YOU NEED A CAR TO RACE' : 'RACE ON FOOT ONLY') : 'YOU LEFT THE RACE', '#ff6b6b', 2500)
      world.net?.send({ t: 'race', a: 'leave' })
      if (!r.online) world.race = null
      else r.joined = false
      return publish()
    }
    if (t >= r.startsAt - GRID * 1000) toGrid()
  }
  if (r.phase === 'grid') {
    const left = Math.ceil((r.startsAt - t) / 1000)
    if (left !== lastBeep && left > 0 && left <= GRID) {
      lastBeep = left
      hooks.message(String(left), '#ffd23a', 800)
      hooks.sound('beep')
    }
    // Offline there's no server to say GO; online, don't wait forever.
    if ((!r.online && t >= r.startsAt) || t >= r.startsAt + 3000) go()
  }
  if (r.phase === 'running') {
    const cp = def.checkpoints[r.cp]
    world.objective = { x: cp.x, z: cp.z }
    if (Math.hypot(cp.x - world.focus.x, cp.z - world.focus.z) < (def.vehicle ? 10 : 4)) {
      r.cp++
      hooks.sound('checkpoint')
      if (r.cp >= def.checkpoints.length) {
        const time = (t - r.started) / 1000
        if (r.online && world.net) world.net.send({ t: 'race', a: 'finish', time })
        else {
          prize(1, time)
          setTimeout(() => world.race?.phase === 'done' && ((world.race = null), publish()), 5000)
        }
        r.phase = 'done'
      } else hooks.banner(`CHECKPOINT ${r.cp}/${def.checkpoints.length}`)
    }
    if (t - r.started > 180000) {
      world.race = null
      hooks.message('RACE OVER', '#ffd23a', 2500)
    }
  }
  if (t - lastPublish > 100) {
    lastPublish = t
    publish()
  }
}

// What Races.jsx should draw: flags always; the next checkpoints while racing.
export function raceMarkers() {
  const r = world.race
  if (!r || r.phase !== 'running') return null
  const def = RACES[r.id]
  return { current: def.checkpoints[r.cp], next: def.checkpoints[r.cp + 1], vehicle: def.vehicle }
}
