import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useKeyboardControls } from '@react-three/drei'
import { Quaternion, Vector3 } from 'three'
import { city, ISLAND, MAINLAND, ROAD, zoneAt } from './cityData'
import { setLane, swapWithPlayerCar, vehicles } from './trafficSim'
import { alightRiders, callBoarders, dismissRiders, copsGrabbing, deployCop, ejectDriver, npcNear, npcs, punchNpc, recallCops, resumeCops, setCarArrestReach, waitingCounts } from './crowd'
import { WORLD } from './City'
import { WATER_Y } from './Water'
import { INTERIORS, mapSpot, roomExit, roomPoint, roomSpawn } from './rooms'
import { activeJob, activeTarget, CHATTER, NPCS, QUESTS, SIDE_JOBS, STRANGER_LINES } from './quests'
import { VEHICLES } from './vehicleTypes'
import { alarm, blip, bust, clang, jingle, MUSIC_STYLES, punchSound, setHorn, setMusic, setSiren, splash, swoosh, thud, trafficHorn, whistle, setRain, thunder } from './audio'
import { CAR_HP, damagePlayerCar, damageVehicle, hurtPlayer } from './damage'
import { fx } from './particles'
import { useGame, world } from './state'
import { emote } from './emotes'
import { raceMarkers, racePrompt, raceInteract, RACES, setRaceHooks, updateRace } from './racing'
export { raceInteract }
import { addChat } from './net'
import { lightFor, signals } from './signals'
import { lineOfSight } from './sight'
import { phone } from './phoneline'
import { dogs, punchDogs } from './strays'
import { updateWeather, weather } from './weather'

const ENTER_DISTANCE = 4.5
const TALK_DISTANCE = 2.6
const q = new Quaternion()
const up = new Vector3(0, 1, 0)

const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z)
const naira = (n) => `₦${n.toLocaleString()}`
let bannerKey = 0
const banner = (text) => useGame.setState({ banner: { text, key: ++bannerKey } })
const message = (text, color = '#ffd23a', ms = 3500) => {
  const key = ++bannerKey
  useGame.setState({ message: { text, color, key } })
  setTimeout(() => useGame.getState().message?.key === key && useGame.setState({ message: null }), ms)
}

export function openDialogue(lines, onDone) {
  useGame.setState({ dialogue: { lines, index: 0, onDone } })
}

function addWanted(n) {
  const { wanted } = useGame.getState()
  const next = Math.min(5, wanted + n)
  if (next !== wanted) useGame.setState({ wanted: next })
  // A fresh crime: they know exactly where you are.
  world.escape = 0
  world.seenFor = 1.5
}

// LASTMA wardens book anyone they see driving through a red light.
function checkRedLights(game) {
  const inBox = new Set()
  // (Not during a street race: the city turns a blind eye.)
  if (game.mode === 'car' && world.car && !game.race && Math.abs(world.carSpeed) > 4) {
    const c = world.car.translation()
    for (const w of city.wardens) {
      if (Math.abs(c.x - w.nx) > 42 || Math.abs(c.z - w.nz) > 42) continue
      const inside = Math.abs(c.x - w.nx) < ROAD / 2 && Math.abs(c.z - w.nz) < ROAD / 2
      if (!inside) continue
      inBox.add(w)
      if (world.redBox?.has(w)) continue
      // Just drove into the junction: which way, and was that way red?
      const h = world.carHeading ?? 0
      const axis = Math.abs(Math.sin(h)) > Math.abs(Math.cos(h)) ? 'x' : 'z'
      if (lightFor(axis) === 'red' && Math.hypot(c.x - w.x, c.z - w.z) < 40) {
        addWanted(1)
        message('LASTMA SAW YOU RUN THE RED LIGHT!', '#ff6b6b', 3000)
        whistle()
      }
    }
  }
  world.redBox = inBox
}

// Losing the police. They chase where they last saw you, not where you are:
// get out of sight (far enough away, or behind buildings) and stay hidden,
// and the stars blink and drop one at a time. Hiding in other buildings
// doesn't count, but getting home clears them.
const SEE_FAR = 60 // m: cars with a clear view see you this far
const SEE_NEAR = 18 // m: this close they hear the engine or see you round a corner
const escapeTime = (wanted) => 6 + wanted * 1.5 // s out of sight per star
let sightCheck = 0

function copCanSee(x, z, focus, far) {
  const d = Math.hypot(x - focus.x, z - focus.z)
  return d < SEE_NEAR || (d < far && lineOfSight(x, z, focus.x, focus.z))
}

function updateEscape(game, dt, focus) {
  // Made it home with the police after you: they can't touch you there.
  if (game.wanted > 0 && game.inside === 'home' && !game.fade) {
    useGame.setState({ wanted: 0, evading: false })
    world.lastSeen = null
    world.escape = 0
    message('SAFE AT HOME\nYOU LOST THEM', '#7cff9a', 3000)
    return
  }
  if (game.wanted === 0) {
    world.lastSeen = null
    world.escape = 0
    if (game.evading) useGame.setState({ evading: false })
    return
  }
  // A few line-of-sight checks a second is plenty.
  sightCheck -= dt
  if (sightCheck <= 0 || !world.lastSeen) {
    sightCheck = 0.2
    let seen = game.inside ? false : vehicles.some((v) => v.chasing && !v.burning && copCanSee(v.x, v.z, focus, SEE_FAR))
    if (!seen && !game.inside) seen = npcs.some((n) => n.kind === 'cop' && n.active && n.down <= 0 && copCanSee(n.x, n.z, focus, 35))
    world.copsSee = seen
  }
  world.seenFor = Math.max(0, (world.seenFor ?? 0) - dt)
  const seen = world.copsSee || world.seenFor > 0 || !world.lastSeen
  if (seen) {
    world.lastSeen = { x: focus.x, z: focus.z }
    world.escape = 0
  } else if (!game.inside) {
    // Lying low right where they last saw you works, but slowly: they're
    // searching that area. Getting well away counts in full.
    const away = Math.hypot(focus.x - world.lastSeen.x, focus.z - world.lastSeen.z)
    world.escape = (world.escape ?? 0) + dt * (away > 45 ? 1 : 0.4)
    if (world.escape > escapeTime(game.wanted)) {
      world.escape = 0
      const wanted = game.wanted - 1
      useGame.setState({ wanted })
      if (wanted === 0) message('YOU LOST THEM', '#7cff9a', 3000)
    }
  }
  const evading = !seen
  if (evading !== game.evading) useGame.setState({ evading })
}

// A step is starting: reset its counters and start its clock, if it has one.
function startStep(def) {
  // Being handed something for this step (the pepper, the flash drive...).
  if (def?.handed) setTimeout(() => banner(def.handed), 1800)
  world.holdTime = 0
  world.stepDeadline = def?.time ? performance.now() + def.time * 1000 : null
  useGame.setState({ jobProgress: 0, collected: [], timer: def?.time ?? null })
}

// Finish the current step of whichever job is running.
function advanceJob() {
  if (useGame.getState().sideJob) advanceSide()
  else advanceQuest()
}

function advanceSide() {
  const { sideJob, money } = useGame.getState()
  const job = SIDE_JOBS[sideJob.index]
  if (sideJob.step < job.steps.length - 1) {
    useGame.setState({ sideJob: { ...sideJob, step: sideJob.step + 1 } })
    startStep(job.steps[sideJob.step + 1])
  } else {
    useGame.setState({ sideJob: null, money: money + job.reward })
    startStep(null)
    jingle()
    message(`SIDE JOB DONE!\n${naira(job.reward)}`, '#7ee07e', 4000)
  }
}

function startSideJob(index) {
  useGame.setState({ sideJob: { index, step: 0 } })
  startStep(SIDE_JOBS[index].steps[0])
  banner(`SIDE JOB: ${SIDE_JOBS[index].title.toUpperCase()}`)
}

function failSideJob(reason) {
  const { sideJob } = useGame.getState()
  if (!sideJob) return
  const giver = NPCS[SIDE_JOBS[sideJob.index].giver]
  useGame.setState({ sideJob: null })
  startStep(null)
  bust()
  message(`${reason}\nTALK TO ${giver.name.toUpperCase()} TO TRY AGAIN`, '#ff6b6b', 3500)
}

function advanceQuest() {
  const { quest, step, money } = useGame.getState()
  const q = QUESTS[quest]
  if (!q) return
  world.holdTime = 0
  if (step < 0) {
    useGame.setState({ step: 0 })
    startStep(q.steps[0])
    banner(`NEW JOB: ${q.title.toUpperCase()}`)
  } else if (step < q.steps.length - 1) {
    useGame.setState({ step: step + 1 })
    startStep(q.steps[step + 1])
  } else {
    startStep(null)
    if (q.restoresHealth) useGame.setState({ health: 100 })
    useGame.setState({ quest: quest + 1, step: -1, money: money + q.reward })
    jingle()
    message(quest + 1 >= QUESTS.length ? `ALL JOBS DONE!\nEKO O NI BAJE!` : `JOB DONE!\n${naira(q.reward)}`, '#7ee07e', 4500)
  }
}

// Up on a footbridge (or a roof) you can't reach a car or a person on the
// road below: only things at about your own height count.
const sameLevel = (from, y = 0.5) => from.y === undefined || Math.abs(from.y - 0.9 - y) < 2.2

function nearestVehicle(from) {
  let best = null
  if (!sameLevel(from)) return null
  if (world.car) {
    const t = world.car.translation()
    const d = flat(t, from)
    if (d < ENTER_DISTANCE) best = { own: true, d, type: useGame.getState().carType, wrecked: world.carWrecked }
  }
  for (const v of vehicles) {
    if (v.wrecked || v.burning > 0) continue
    const d = flat(v, from)
    if (d < ENTER_DISTANCE + VEHICLES[v.type].half[2] * 0.5 && (!best || d < best.d)) best = { v, d, type: v.type }
  }
  return best
}

function nearestNamedNpc(from) {
  let best = null
  for (const [id, n] of Object.entries(NPCS)) {
    if (!sameLevel(from, n.y ?? 0)) continue
    const d = Math.hypot(n.pos[0] - from.x, n.pos[1] - from.z)
    // Someone behind a counter or a pulpit can be talked to from a bit further.
    if (d < (n.talkRange ?? TALK_DISTANCE) && (!best || d < best.d)) best = { id, n, d }
  }
  return best
}

// --- Buildings ---

function placePlayer(x, y, z, facing) {
  // Still loading: try again in a moment.
  if (!world.player) return void setTimeout(() => placePlayer(x, y, z, facing), 100)
  world.player.setTranslation({ x, y, z }, true)
  world.player.setLinvel({ x: 0, y: 0, z: 0 }, true)
  world.focus.set(x, y, z)
  world.forceFacing = world.heading = facing
  // Camera behind the way he's facing.
  world.cameraYaw = facing + Math.PI
  world.cameraPitch = 0.3
}

// Put the player inside a room (or back outside its door), no fade.
export function placeInRoom(id) {
  const room = INTERIORS[id]
  const [x, y, z] = roomSpawn(room)
  // A little scatter, so friends coming through the same door don't overlap.
  placePlayer(x + (Math.random() - 0.5) * 2, y, z, Math.PI)
  world.simFocus = { x: room.door.x, z: room.door.z }
  useGame.setState({ inside: id })
}

function placeOutside(id) {
  const door = INTERIORS[id].door
  placePlayer(door.x, 1.2, door.z + 0.6, 0)
  world.simFocus = null
  useGame.setState({ inside: null })
}

// Walk through a door with a quick fade to black.
function goThrough(fn, force = false) {
  if (useGame.getState().fade && !force) return
  useGame.setState({ fade: true })
  setTimeout(() => {
    fn()
    setTimeout(() => useGame.setState({ fade: false }), 150)
  }, 350)
}

// Races (races.js) move you to the start line and pay out through these.
setRaceHooks({
  message: (text, color, ms) => message(text, color, ms),
  banner: (text) => banner(text),
  chat: (text) => addChat(null, text, true),
  addMoney: (amount) => useGame.setState({ money: useGame.getState().money + amount }),
  sound: (what) => (what === 'win' ? jingle() : what === 'go' ? honkGo() : blip()),
  placeAt: (x, z, yaw, vehicle) => {
    if (vehicle && world.car) {
      world.carSkipCrash = performance.now() + 800
      world.car.setTranslation({ x, y: 1, z }, true)
      world.car.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true)
      world.car.setLinvel({ x: 0, y: 0, z: 0 }, true)
      world.car.setAngvel({ x: 0, y: 0, z: 0 }, true)
    } else placePlayer(x, 1.2, z, yaw)
    world.cameraYaw = yaw + Math.PI
  },
})
const honkGo = () => {
  blip()
  setTimeout(blip, 120)
}

// Jump to the nearest friend online (G, or the 👥 button on phones): beside
// them in the street, or into the same building if they're indoors.
export function goToFriend() {
  const game = useGame.getState()
  if (game.phase !== 'playing' || game.dialogue || game.busted || game.wasted) return
  const friends = [...(world.net?.remotes.values() ?? [])].filter((r) => r.s)
  if (!friends.length) return message(world.net ? 'NOBODY ELSE IS ONLINE' : 'YOU ARE OFFLINE', '#ffd23a', 2200)
  if (game.mode !== 'foot') return message('GET OUT OF THE CAR FIRST', '#ffd23a', 2200)
  if (game.wanted > 0) return message('LOSE THE POLICE FIRST', '#ff6b6b', 2200)
  const from = mapSpot(world.focus.x, world.focus.z)
  friends.sort((a, b) => {
    const pa = mapSpot(a.x, a.z)
    const pb = mapSpot(b.x, b.z)
    return Math.hypot(pa.x - from.x, pa.z - from.z) - Math.hypot(pb.x - from.x, pb.z - from.z)
  })
  const friend = friends[0]
  const spot = mapSpot(friend.x, friend.z)
  goThrough(() => {
    if (spot.room) {
      placeInRoom(spot.room.id)
    } else {
      if (game.inside) placeOutside(game.inside)
      // A couple of meters to the side of them, facing the same way.
      const side = friend.yaw + Math.PI / 2
      const onFoot = friend.s.m === 'f'
      const gap = onFoot ? 1.6 : 3.2
      placePlayer(friend.x + Math.sin(side) * gap, Math.max(1.2, friend.y + 0.4), friend.z + Math.cos(side) * gap, friend.yaw)
    }
    banner(`WITH ${friend.name.toUpperCase()}`)
  })
}

// --- Food ---
// Stand at a mama put stall and press E: pay, eat for a few seconds, and get
// some health back.
export function nearFood() {
  if (useGame.getState().inside) return null
  let best = null
  let bestD = 3
  for (const f of city.foodSpots) {
    const d = Math.hypot(f.x - world.focus.x, f.z - world.focus.z)
    if (d < bestD) {
      best = f
      bestD = d
    }
  }
  return best
}

const EAT_TIME = 3 // seconds
function buyFood(food) {
  const game = useGame.getState()
  if (world.eating) return
  if (game.money < food.price) return message('NOT ENOUGH MONEY', '#ff6b6b', 2000)
  useGame.setState({ money: game.money - food.price })
  world.eating = { t: EAT_TIME, food }
  useGame.setState({ subtitle: { speaker: 'Mama Put', text: `Your ${food.name}, hot hot! ${naira(food.price)}.`, key: ++bannerKey } })
  const key = bannerKey
  setTimeout(() => useGame.getState().subtitle?.key === key && useGame.setState({ subtitle: null }), 2500)
}

function updateEating(dt) {
  const e = world.eating
  if (!e) return
  e.t -= dt
  if (e.t <= 0) {
    world.eating = null
    const health = Math.min(100, useGame.getState().health + e.food.health)
    useGame.setState({ health })
    jingle()
    message(`YUM! ${e.food.name.toUpperCase()}\n+${e.food.health} HEALTH`, '#7ee07e', 2200)
  }
}

const nearDoor = (from) => city.doors.find((d) => Math.hypot(d.x - from.x, d.z - from.z) < 2.4)
function nearExit() {
  const id = useGame.getState().inside
  if (!id) return false
  const [x, , z] = roomExit(INTERIORS[id])
  return Math.hypot(x - world.focus.x, z - world.focus.z) < 2.4
}
// Things you can use inside: the bed at home and the benches at the gym.
function nearUsable() {
  const id = useGame.getState().inside
  if (id === 'home') {
    const home = INTERIORS.home
    const near = (lx, lz, r) => {
      const [x, , z] = roomPoint(home, lx, lz)
      return Math.hypot(x - world.focus.x, z - world.focus.z) < r
    }
    if (near(...home.wardrobe, 1.3)) return 'wardrobe'
    if (near(...home.laptop, 1.3)) return 'laptop'
    if (near(5.4, 3, 2.2)) return 'bed'
  }
  if (id === 'gym') {
    for (const bx of [-6, -2, 2]) {
      const [x, , z] = roomPoint(INTERIORS.gym, bx, -3)
      if (Math.hypot(x - world.focus.x, z - world.focus.z) < 1.8) return 'bench'
    }
  }
  return null
}

function useThing(thing) {
  if (thing === 'wardrobe') return useGame.setState({ panel: 'wardrobe' })
  if (thing === 'laptop') return useGame.setState({ panel: 'decor' })
  if (thing === 'bed') {
    goThrough(() => {
      world.time = 7 * 60
      useGame.setState({ health: 100 })
      message('GOOD MORNING', '#ffd23a', 2500)
    })
  } else if (thing === 'bench') {
    world.forceFacing = 0
    world.workout = 3
    message('NO PAIN, NO GAIN', '#ffd23a', 2200)
    setTimeout(() => {
      useGame.setState({ health: 100 })
      banner('HEALTH FULL')
    }, 3000)
  }
}

// --- Passengers in your own danfo or keke ---

const FARE = 200
function nearestStop(from, within) {
  let best = null
  let bestD = within
  for (const s of city.busStops) {
    const d = Math.hypot(s.x - from.x, s.z - from.z)
    if (d < bestD) {
      best = s
      bestD = d
    }
  }
  return best
}

// Passengers get out and rejoin the crowd on the pavement (the car changed
// hands, or it was towed away).
function letRidersOff(vehicle) {
  if (vehicle.riders?.length) dismissRiders(vehicle)
}

function exitCar() {
  const c = world.car.translation()
  const left = world.carHeading + Math.PI / 2
  world.player.setTranslation({ x: c.x + Math.sin(left) * 2.2, y: 1.2, z: c.z + Math.cos(left) * 2.2 }, true)
  world.player.setLinvel({ x: 0, y: 0, z: 0 }, true)
  world.player.setEnabled(true)
  world.carSpeed = 0
  world.carSkipCrash = performance.now() + 500
  useGame.setState({ mode: 'foot' })
}

function enterOrExit() {
  const game = useGame.getState()
  if (game.phase !== 'playing' || game.dialogue || game.busted || game.chatOpen || !world.player || !world.car) return
  if (game.mode === 'car') return exitCar()

  const target = nearestVehicle(world.focus)
  if (!target || (target.own && target.wrecked) || world.playerDown > 0) return
  if (!target.own) {
    // Carjacking: drag whoever is driving out, then the traffic vehicle and
    // the player's car swap places.
    const v = target.v
    // Nobody rides along into a different car: your old passengers and the
    // jacked car's passengers all get out.
    letRidersOff(v)
    letRidersOff(world.playerVehicle)
    if (v.state !== 'parked' && !v.officerOut) {
      ejectDriver(v.x, v.z, v.yaw, world.focus)
      fx.pow(v.x, 2, v.z, 'OI!')
    }
    const t = world.car.translation()
    const taken = swapWithPlayerCar(target.v, { type: game.carType, color: game.carColor, x: t.x, z: t.z, yaw: world.carHeading ?? 0, hp: world.carHp ?? CAR_HP })
    if (world.carWrecked) {
      target.v.wrecked = true
      target.v.color = '#2b2626'
    }
    world.carWrecked = false
    world.carBurning = 0
    world.carHp = taken.hp ?? CAR_HP
    world.carSkipCrash = performance.now() + 500
    const half = VEHICLES[taken.type].half
    q.setFromAxisAngle(up, taken.yaw)
    world.car.setTranslation({ x: taken.x, y: half[1] + 0.05, z: taken.z }, true)
    world.car.setRotation(q, true)
    world.car.setLinvel({ x: 0, y: 0, z: 0 }, true)
    world.carHeading = taken.yaw
    useGame.setState({ carType: taken.type, carColor: taken.color })
    if (taken.police) addWanted(2)
  }
  world.player.setEnabled(false)
  world.heading = world.carHeading
  useGame.setState({ mode: 'car', prompt: null })
  banner(VEHICLES[useGame.getState().carType].name.toUpperCase())
}

function interact() {
  const game = useGame.getState()
  if (game.phase !== 'playing' || game.dialogue || game.panel || game.mode !== 'foot' || game.chatOpen) return
  // The key press that closed a dialogue shouldn't open a new one.
  if (performance.now() - (world.dialogueClosedAt ?? 0) < 400) return
  if (game.fade) return
  if (game.inside && nearExit()) return goThrough(() => placeOutside(game.inside))
  const thing = nearUsable()
  if (thing) return useThing(thing)
  const door = !game.inside && nearDoor(world.focus)
  if (door) return goThrough(() => placeInRoom(door.id))
  const near = nearestNamedNpc(world.focus)
  if (near) {
    const target = activeTarget(game)
    const active = activeJob(game)
    const side = SIDE_JOBS.findIndex((j) => j.giver === near.id)
    if (target?.npc === near.id) {
      openDialogue(active.step < 0 ? active.job.start : active.job.steps[active.step].talk, advanceJob)
    } else if (side >= 0 && !game.sideJob) {
      openDialogue(SIDE_JOBS[side].start, () => startSideJob(side))
    } else if (side >= 0) {
      openDialogue([{ speaker: near.n.name, text: 'You never finish that work. Go, go!' }])
    } else {
      openDialogue([{ speaker: near.n.name, text: CHATTER[Math.floor(Math.random() * CHATTER.length)] }])
    }
    return
  }
  // A mama put stall: buy something to eat.
  const food = nearFood()
  if (food) return buyFood(food)
  // Anyone else on the street just says something short.
  let best = null
  let bestD = 2.2
  for (const n of npcs) {
    const d = Math.hypot(n.x - world.focus.x, n.z - world.focus.z)
    if (d < bestD && n.down <= 0 && n.active !== false) {
      best = n
      bestD = d
    }
  }
  if (best) {
    if (best.kind !== 'walk') best.yaw = Math.atan2(world.focus.x - best.x, world.focus.z - best.z)
    const who = best.role === 'trader' || best.role === 'seller' ? 'Trader' : best.role === 'bouncer' ? 'Bouncer' : best.role === 'cop' ? 'Officer' : 'Passer-by'
    const text =
      best.role === 'bouncer'
        ? 'You no dey the list. Comot.'
        : best.role === 'cop'
          ? '{Oga|Madam}, you dey under arrest!'
          : best.role === 'trader' || best.role === 'seller'
            ? 'Customer! Come buy, I go do you good price.'
            : STRANGER_LINES[Math.floor(Math.random() * STRANGER_LINES.length)]
    useGame.setState({ subtitle: { speaker: who, text, key: ++bannerKey } })
    const key = bannerKey
    setTimeout(() => useGame.getState().subtitle?.key === key && useGame.setState({ subtitle: null }), 2500)
  }
}

function policeNearby(radius = 45) {
  return vehicles.some((v) => v.police && flat(v, world.focus) < radius)
}

export function resetPlayerCar() {
  letRidersOff(world.playerVehicle)
  world.carWrecked = false
  world.carBurning = 0
  world.carHp = CAR_HP
  world.carSkipCrash = performance.now() + 500
  q.setFromAxisAngle(up, city.carSpawnYaw)
  world.car.setTranslation({ x: city.carSpawn[0], y: city.carSpawn[1], z: city.carSpawn[2] }, true)
  world.car.setRotation(q, true)
  world.car.setLinvel({ x: 0, y: 0, z: 0 }, true)
  useGame.setState({ carType: 'sedan', carColor: '#c9ccd1' })
}

const RAIN_LINES = ['Rain don start o! Make I run!', 'Ah, see rain! My hair o!', 'This rain no go small today.', 'Quick quick, find shade!']

const ANGRY = ['Ah! Wetin I do you?', 'You dey craze?', 'Oya come and fight me!', 'Na wa for you o!']

let punchSide = 1
let lastPunch = 0
export function punch() {
  const game = useGame.getState()
  if (game.phase !== 'playing' || game.mode !== 'foot' || game.dialogue || game.busted || game.wasted || world.playerDown > 0 || game.chatOpen) return
  const now = performance.now()
  if (now - lastPunch < 330) return
  lastPunch = now
  punchSide = -punchSide
  world.punch = { t: 0, side: punchSide, resolved: false }
  swoosh()
}

// Called when the punch animation reaches full extension.
function resolvePunch() {
  const h = world.heading
  const px = world.focus.x + Math.sin(h) * 0.9
  const pz = world.focus.z + Math.cos(h) * 0.9
  const landed = (x, z, word, strong = false) => {
    fx.pow(x, 1.7, z, word)
    fx.sparks(x, 1.3, z, 6, '#ffffff')
    fx.shake(strong ? 0.3 : 0.15)
    punchSound()
  }

  if (world.net?.punchPlayers(px, pz)) return landed(px, pz)

  const npc = npcNear(px, pz, 0.9)
  if (npc) {
    const result = punchNpc(npc, world.focus.x, world.focus.z)
    landed(npc.x + npc.ox, npc.z + npc.oz, result === 'down' ? 'WHAM!' : undefined, result === 'down')
    if (policeNearby() && timers.copWatch <= 0) {
      addWanted(1)
      timers.copWatch = 4
    }
    return
  }

  const named = nearestNamedNpc({ x: px, z: pz })
  if (named && named.d < 1.4) {
    named.n.flinchAt = performance.now()
    landed(named.n.pos[0], named.n.pos[1])
    useGame.setState({ subtitle: { speaker: named.n.name, text: ANGRY[Math.floor(Math.random() * ANGRY.length)], key: ++bannerKey } })
    const key = bannerKey
    setTimeout(() => useGame.getState().subtitle?.key === key && useGame.setState({ subtitle: null }), 2500)
    return
  }

  // A dog: it yelps and runs (no damage). People come first, since dogs
  // share the pavement with them.
  if (punchDogs(px, pz, world.focus)) return landed(px, pz)

  // Punching cars: a dent, sparks and an angry horn.
  const inBox = (cx, cz, yaw, half) => {
    const rx = px - cx
    const rz = pz - cz
    const c = Math.cos(yaw)
    const s = Math.sin(yaw)
    return Math.abs(rx * c - rz * s) < half[0] + 0.45 && Math.abs(rx * s + rz * c) < half[2] + 0.45
  }
  for (const v of vehicles) {
    if (inBox(v.x, v.z, v.yaw, VEHICLES[v.type].half)) {
      damageVehicle(v, 6)
      clang()
      fx.sparks(px, 1, pz, 10)
      fx.pow(px, 1.8, pz, 'BANG!')
      if (!v.wrecked && v.state !== 'parked' && world.listener) trafficHorn(v.type, v.x, v.z, world.listener, 0.5, 2)
      if (v.police) addWanted(1)
      return
    }
  }
  if (world.car) {
    const t = world.car.translation()
    if (inBox(t.x, t.z, world.carHeading ?? 0, VEHICLES[useGame.getState().carType].half)) {
      damagePlayerCar(6)
      clang()
      fx.sparks(px, 1, pz, 10)
      fx.pow(px, 1.8, pz, 'BANG!')
    }
  }
}

const timers = { copWatch: 0 }

function getWasted() {
  failSideJob('WASTED')
  const game = useGame.getState()
  if (game.wasted || game.busted) return
  useGame.setState({ wasted: true, dialogue: null })
  bust()
  message('WASTED', '#e8343a', 3200)
  setTimeout(() => {
    if (useGame.getState().mode === 'car') exitCar()
    world.playerDown = 0
    if (world.carWrecked) resetPlayerCar()
    // You wake up in the General Hospital, patched up, with a bill.
    goThrough(() => {
      placeInRoom('hospital')
      const { money } = useGame.getState()
      const bill = Math.min(money, 500)
      useGame.setState({ wasted: false, wanted: 0, health: 100, money: money - bill })
      setTimeout(() => message(`LAGOS GENERAL HOSPITAL\nHOSPITAL BILL ${naira(bill)}`, '#ffffff', 3500), 600)
    }, true)
  }, 3000)
}

function getBusted() {
  failSideJob('BUSTED')
  const game = useGame.getState()
  if (game.busted) return
  useGame.setState({ busted: true, dialogue: null })
  bust()
  message('BUSTED', '#5aa0ff', 3200)
  setTimeout(() => {
    if (useGame.getState().mode === 'car') exitCar()
    if (world.carWrecked) resetPlayerCar()
    // A night at the station, then they let you go once the bail is paid.
    goThrough(() => {
      placeInRoom('police')
      const { money } = useGame.getState()
      const bail = Math.min(money, 1000)
      useGame.setState({ busted: false, wanted: 0, health: 100, money: money - bail })
      setTimeout(() => message(`RELEASED ON BAIL\n${naira(bail)}`, '#7fb3ff', 3500), 600)
    }, true)
  }, 3000)
}

export default function GameLogic() {
  const [subscribeKeys] = useKeyboardControls()
  const timers = useRef({ hud: 0, zone: 0, hitCooldown: 0, ramCooldown: 0, busting: 0 })

  useEffect(() => {
    const subs = [
      subscribeKeys((s) => s.enter, (p) => p && enterOrExit()),
      subscribeKeys((s) => s.interact, (p) => p && !raceInteract() && interact()),
      subscribeKeys((s) => s.horn, (p) => setHorn(p && useGame.getState().mode === 'car' && !useGame.getState().chatOpen)),
    ]
    const onMouse = (e) => e.button === 0 && document.pointerLockElement && punch()
    window.addEventListener('mousedown', onMouse)
    const onKey = (e) => {
      const game = useGame.getState()
      if (game.chatOpen || game.panel || e.target instanceof HTMLInputElement) return
      if (e.code === 'KeyP' && game.phase === 'playing') {
        document.exitPointerLock?.()
        phone.open()
        return
      }
      if (e.code === 'KeyY' && game.phase === 'playing') {
        e.preventDefault()
        document.exitPointerLock?.()
        useGame.setState({ chatOpen: true })
        return
      }
      if (e.code === 'KeyX') punch()
      if (e.code === 'KeyG') goToFriend()
      if (/^Digit[1-8]$/.test(e.code) && game.phase === 'playing') emote(Number(e.code.slice(5)) - 1)
      if (e.code === 'KeyM') {
        // Cycle: calm theme -> Afrobeats -> off.
        const music = MUSIC_STYLES[(MUSIC_STYLES.indexOf(game.music) + 1) % MUSIC_STYLES.length]
        setMusic(music)
        useGame.setState({ music })
        banner(music === 'calm' ? 'MUSIC: CALM' : music === 'afro' ? 'MUSIC: AFROBEATS' : 'MUSIC OFF')
      }
      if (e.code === 'KeyO') useGame.setState({ outlines: !game.outlines })
      if (e.code === 'KeyT' && game.phase === 'playing') world.time = (world.time + 60) % 1440
    }
    window.addEventListener('keydown', onKey)
    return () => {
      subs.forEach((u) => u())
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onMouse)
    }
  }, [subscribeKeys])

  useFrame((_, rawDt) => {
    if (!world.player || !world.car) return
    const dt = Math.min(rawDt, 0.1)
    const t = timers.current
    const game = useGame.getState()
    if (game.phase !== 'playing') return

    if (world.punch && !world.punch.resolved && world.punch.t >= 0.45) {
      world.punch.resolved = true
      resolvePunch()
    }
    timers.copWatch -= dt

    // Knocking people down and ramming the police get you wanted.
    t.hitCooldown -= dt
    t.ramCooldown -= dt
    while (world.events.length) {
      const e = world.events.shift()
      if (e.type === 'pedHit') {
        thud()
        e.hits.forEach((h) => {
          fx.pow(h.x, 1.6, h.z, 'BAM!')
          fx.dust(h.x, 0.3, h.z, 5)
        })
        if (t.hitCooldown <= 0) {
          addWanted(1)
          t.hitCooldown = 2
        }
      } else if (e.type === 'npcPunch') {
        hurtPlayer(e.damage, e.x, e.z)
        punchSound()
      } else if (e.type === 'copHit' && t.ramCooldown <= 0) {
        addWanted(1)
        t.ramCooldown = 3
      } else if (e.type === 'eject' && useGame.getState().mode === 'car') {
        exitCar()
      } else if (e.type === 'wasted') {
        getWasted()
      }
    }
    // Weather: rain after a while of playing (weather.js).
    if (game.phase === 'playing') world.playSeconds = (world.playSeconds ?? 0) + dt
    if (updateWeather(dt, world.playSeconds) && !game.inside) {
      useGame.setState({ subtitle: { speaker: 'Passer-by', text: RAIN_LINES[Math.floor(Math.random() * RAIN_LINES.length)], key: ++bannerKey } })
      const key = bannerKey
      setTimeout(() => useGame.getState().subtitle?.key === key && useGame.setState({ subtitle: null }), 3000)
    }
    setRain(weather.rain, !!game.inside)
    if (weather.rain > 0.85 && performance.now() > weather.nextThunder) {
      weather.nextThunder = performance.now() + 18000 + Math.random() * 30000
      if (!game.inside) weather.flash = 1
      thunder()
    }

    // Health slowly comes back once you've stayed out of trouble for a bit.
    if (game.health < 100 && performance.now() - (world.lastHurt ?? 0) > 6000 && !game.wasted) {
      t.regen = (t.regen ?? 0) + dt * 3
      if (t.regen >= 1) {
        useGame.setState({ health: Math.min(100, game.health + Math.floor(t.regen)) })
        t.regen %= 1
      }
    }

    // Police: busted if they catch you, wanted level drops if you lose them.
    let nearestCop = Infinity
    // Indoors, the police wait at the door you went through.
    const copsAim = game.inside ? world.simFocus : world.focus
    for (const v of vehicles) if (v.chasing) nearestCop = Math.min(nearestCop, flat(v, copsAim))
    // Our chase, or (fainter) a friend's chase going past us.
    setSiren(Math.max(game.wanted > 0 ? Math.max(0, 1 - nearestCop / 120) : 0, game.inside ? 0 : (world.remoteSiren ?? 0) * 0.7))
    world.remoteSiren = 0
    const onFoot = game.mode === 'foot'
    const carStopped = !onFoot && Math.abs(world.carSpeed) < 3
    // In a stopped car, officers reach in through the door to arrest you.
    setCarArrestReach(carStopped ? VEHICLES[game.carType].half[0] + 1.4 : 0)
    if (game.wanted > 0 && (onFoot || carStopped)) {
      // Patrol cars close to you let an officer out.
      for (const v of vehicles) {
        if (v.chasing && !v.officerOut && flat(v, world.focus) < 14) deployCop(v, world.focus)
      }
    }
    // Officers on foot who lose sight of you go back to their car.
    if (game.wanted === 0 || game.evading || (!onFoot && !carStopped)) recallCops()
    else resumeCops()
    if (game.wanted > 0) {
      // An officer has to get hold of you, on foot or through the car door.
      const caught = copsGrabbing()
      t.busting = caught ? t.busting + dt : Math.max(0, t.busting - dt)
      if (t.busting > 1.2) {
        t.busting = 0
        getBusted()
      }
    }
    updateEscape(game, dt, copsAim)
    checkRedLights(game)

    // Passengers: stop your danfo or keke at a bus stop to let riders off
    // (they pay) and take on whoever is waiting.
    const pv = world.playerVehicle
    if (world.car) {
      const c = world.car.translation()
      pv.x = c.x
      pv.z = c.z
      pv.yaw = world.carHeading ?? 0
    }
    const def = VEHICLES[game.carType]
    let droppedAt = null
    if (game.mode === 'car' && def.picksUp && Math.abs(world.carSpeed) < 0.6) {
      const stop = nearestStop(pv, 9)
      if (stop && t.lastStop !== stop.id) {
        t.lastStop = stop.id
        if (pv.riders.length) {
          const n = alightRiders(stop, pv)
          useGame.setState({ money: useGame.getState().money + n * FARE })
          message(`FARE +${naira(n * FARE)}`, '#7ee07e', 2200)
          droppedAt = stop
        }
      }
      // Anyone waiting (or turning up while you wait) gets on, while there's room.
      if (stop) {
        const coming = npcs.filter((n) => n.kind === 'boarding' && n.vehicle === pv).length
        const room = def.passengers.length - pv.riders.length - coming
        if (room > 0) callBoarders(stop, pv, room)
      }
    }
    if (game.mode === 'car' && Math.abs(world.carSpeed) > 3) t.lastStop = null
    if (pv.riders.length !== game.riders.length) useGame.setState({ riders: pv.riders.map((n) => n.look) })

    // Mission steps that complete by themselves.
    const target = activeTarget(game)
    world.objective = target && target.x !== undefined ? { x: target.x, z: target.z } : null
    // Racing: the race's checkpoints take over the radar marker.
    updateRace()
    updateEating(dt)
    const active = activeJob(game)
    const stepDef = active?.job.steps[active.step]
    // What's in Tunde's hand: food while eating, else whatever this job step
    // has him carry (Mama Nkechi's nylon of pepper, the flash drive...).
    const carry = world.eating ? 'food' : game.mode === 'foot' ? (stepDef?.carry ?? null) : null
    const carryColor = world.eating?.food.color ?? null
    world.carry = carry && carry !== 'food'
    if (carry !== game.carry || carryColor !== game.carryColor) useGame.setState({ carry, carryColor })
    // Timed steps: the clock runs out and the job is off.
    if (world.stepDeadline) {
      const left = Math.max(0, Math.ceil((world.stepDeadline - performance.now()) / 1000))
      if (left !== game.timer) useGame.setState({ timer: left })
      if (left <= 0 && !game.dialogue) {
        world.stepDeadline = null
        if (game.sideJob) failSideJob('TOO SLOW!')
        else useGame.setState({ timer: null })
      }
    }
    const rightVehicle = !target?.vehicle || (game.mode === 'car' && (target.vehicle === true || game.carType === target.vehicle))
    if (target && !game.dialogue && !game.fade) {
      if (target.goto && Math.hypot(target.x - world.focus.x, target.z - world.focus.z) < 6 && rightVehicle) {
        world.stepDeadline = null
        openDialogue(stepDef.talk, advanceJob)
      } else if (target.checkpoints && rightVehicle && Math.hypot(target.x - world.focus.x, target.z - world.focus.z) < (target.vehicle ? 10 : 4)) {
        const done = target.done + 1
        blip()
        if (done >= target.count) {
          world.stepDeadline = null
          useGame.setState({ jobProgress: done })
          openDialogue(stepDef.talk, advanceJob)
        } else {
          useGame.setState({ jobProgress: done })
          banner(`CHECKPOINT ${done}/${target.count}`)
        }
      } else if (target.collect && game.mode === 'foot') {
        const got = target.items.findIndex((it, k) => !game.collected.includes(k) && Math.hypot(it.x - world.focus.x, it.z - world.focus.z) < 1.8)
        if (got >= 0) {
          const collected = [...game.collected, got]
          swoosh()
          useGame.setState({ collected, jobProgress: collected.length })
          if (collected.length >= target.count) {
            world.stepDeadline = null
            openDialogue(stepDef.talk, advanceJob)
          } else banner(`${collected.length}/${target.count}`)
        }
      } else if (target.enter && game.inside === target.enter) {
        advanceJob()
      } else if (target.lose && game.wanted === 0) {
        banner('YOU LOST THEM')
        advanceJob()
      } else if (target.pickup && rightVehicle && pv.riders.length >= target.count) {
        banner('PASSENGERS ON BOARD')
        advanceJob()
      } else if (target.dropoff && droppedAt?.id === target.stop.id) {
        openDialogue(stepDef.talk, advanceJob)
      } else if (target.hold && game.inside === target.hold) {
        const spot = target.spot
        const there = game.mode === 'foot' && Math.hypot(spot.x - world.focus.x, spot.z - world.focus.z) < 1.6
        if (there) {
          if (!world.holdTime && stepDef.alarm) {
            alarm()
            useGame.setState({ wanted: Math.max(game.wanted, 3) })
            message('ALARM!', '#e8343a', 2000)
          }
          world.holdTime = (world.holdTime ?? 0) + dt
          if (world.holdTime >= target.seconds) {
            banner('GOT THE MONEY')
            useGame.setState({ hold: null })
            advanceJob()
          }
        }
        const progress = Math.min(1, (world.holdTime ?? 0) / target.seconds)
        if (Math.abs((game.hold?.progress ?? -1) - progress) > 0.02) useGame.setState({ hold: { progress } })
      }
    }
    if (!target?.hold && game.hold) useGame.setState({ hold: null })

    // Into the lagoon or the sea. On foot you just swim (Player.jsx); a car
    // sinks, you swim out, and it's towed back home.
    const body = game.mode === 'car' ? world.car : world.player
    if (game.mode === 'foot' && world.swimming && !t.wasSwimming) splash()
    t.wasSwimming = game.mode === 'foot' && world.swimming
    if (game.mode === 'car' && world.car && world.car.translation().y < WATER_Y - 0.8 && !game.inside) {
      splash()
      exitCar()
      resetPlayerCar()
      message('SPLASH!\nYOUR CAR SANK. IT WAS TOWED HOME', '#7fd0ff', 3000)
    }
    // Safety net: thrown off the map somehow, or through a room's floor.
    if (body && game.mode === 'foot') {
      const p = body.translation()
      const lost = game.inside ? p.y < INTERIORS[game.inside].origin[1] - 20 : Math.abs(p.x) > WORLD.maxX + 600 || Math.abs(p.z) > WORLD.maxZ + 600 || p.y > 300 || p.y < -30
      if (lost) {
        if (game.inside) placeInRoom(game.inside)
        else placePlayer(INTERIORS.home.door.x, 1.2, INTERIORS.home.door.z + 0.6, 0)
      }
    }

    t.zone += dt
    if (t.zone > 0.5) {
      t.zone = 0
      const zone = game.inside ? INTERIORS[game.inside].name : zoneAt(world.focus.x, world.focus.z)
      if (zone !== game.zone) {
        useGame.setState({ zone })
        banner(zone)
      }
    }

    t.hud += dt
    if (t.hud < 0.1) return
    t.hud = 0
    const kmh = Math.round(Math.abs(world.carSpeed ?? 0) * 3.6)
    // The prompt in the corner, and (for the phone's action button) what
    // pressing it would do: { key, icon, label }.
    let prompt = null
    let action = null
    const act = (key, icon, label) => (action = { key, icon, label })
    if (game.mode === 'foot' && !game.dialogue && !game.panel) {
      const npc = nearestNamedNpc(world.focus)
      const car = !npc && !game.inside && nearestVehicle(world.focus)
      const door = !game.inside && nearDoor(world.focus)
      const thing = nearUsable()
      if (game.inside && nearExit()) (prompt = 'Press E to go outside'), act('KeyE', '🚪', 'Exit')
      else if (thing === 'wardrobe') (prompt = 'Press E to change clothes'), act('KeyE', '👕', 'Clothes')
      else if (thing === 'laptop') (prompt = 'Press E to decorate your room'), act('KeyE', '🛋️', 'Decorate')
      else if (thing === 'bed') (prompt = 'Press E to sleep until morning'), act('KeyE', '🛏️', 'Sleep')
      else if (thing === 'bench') (prompt = 'Press E to work out'), act('KeyE', '🏋️', 'Lift')
      else if (door) (prompt = `Press E to enter ${door.name}`), act('KeyE', '🚪', 'Enter')
      else if (npc) (prompt = `Press E to talk to ${npc.n.name}`), act('KeyE', '💬', 'Talk')
      else if (car?.wrecked) prompt = 'This car is wrecked. Find another one.'
      else if (car) (prompt = `Press F to ${car.own ? 'enter' : 'jack'} the ${VEHICLES[car.type].name}`), act('KeyF', '🚗', car.own ? 'Drive' : 'Jack')
      else {
        const food = nearFood()
        if (food) (prompt = `Press E to buy ${food.name} (${naira(food.price)})`), act('KeyE', food.icon, 'Eat')
      }
    }
    if (!prompt && !game.dialogue && !game.inside) {
      prompt = racePrompt()
      if (prompt?.startsWith('Press E')) act('KeyE', '🏁', 'Race')
    }
    if (JSON.stringify(action) !== JSON.stringify(game.action)) useGame.setState({ action })
    const carHp = Math.round(world.carHp ?? CAR_HP)
    if (kmh !== game.speed || prompt !== game.prompt || carHp !== game.carHp) useGame.setState({ speed: kmh, prompt, carHp })
  })

  // Debug hooks for automated testing (dev server only).
  const three = useThree()
  useEffect(() => {
    if (!import.meta.env.DEV) return
    window.__game = {
      renderInfo: () => {
        let casters = 0
        let lights = []
        three.scene.traverse((o) => {
          if (o.castShadow && o.isMesh) casters++
          if (o.isDirectionalLight) lights.push({ cast: o.castShadow, pos: o.position.toArray().map(Math.round), target: o.target.position.toArray().map(Math.round), intensity: o.intensity })
        })
        return { shadowMap: three.gl.shadowMap.enabled, type: three.gl.shadowMap.type, casters, lights, calls: three.gl.info.render.calls, triangles: three.gl.info.render.triangles }
      },
      state: () => useGame.getState(),
      // Draw calls and triangles for one whole frame (all passes).
      frameStats: () =>
        new Promise((done) => {
          const info = three.gl.info
          requestAnimationFrame(() => {
            info.autoReset = false
            info.reset()
            requestAnimationFrame(() => {
              const stats = { calls: info.render.calls, triangles: info.render.triangles, frames: info.render.frame }
              info.autoReset = true
              done(stats)
            })
          })
        }),
      carSpeed: () => world.carSpeed,
      // Crowd members standing somewhere they shouldn't: over the lagoon or the sea.
      wetNpcs: () => {
        const onLand = (x, z) => (x >= WORLD.minX && x <= MAINLAND.maxX) || (x >= ISLAND.minX && x <= WORLD.maxX)
        const onBridge = (x, z) => city.bridges.some((b) => Math.abs(z - b.z) < 8)
        return npcs
          .map((n, i) => ({ i, kind: n.kind, role: n.role, x: n.x, z: n.z, active: n.active }))
          .filter((n) => n.x !== undefined && n.active !== false && n.x < 1500 && (!onLand(n.x, n.z) && !onBridge(n.x, n.z) || n.z < WORLD.minZ || n.z > WORLD.maxZ || n.x < WORLD.minX || n.x > WORLD.maxX))
      },
      // A crowd member, by index, or the nearest one to the player.
      crowdNpc: (i) => {
        const n = i === undefined ? npcNear(world.focus.x, world.focus.z, 8) : npcs[i]
        return n && { i: npcs.indexOf(n), tough: !!n.tough, kind: n.kind, role: n.role, x: n.x, z: n.z, y: n.y, down: n.down, hp: n.hp, active: n.active, panic: n.panic, fight: n.fight }
      },
      remotes: () => [...(world.net?.remotes.values() ?? [])].map((r) => ({ x: r.x, y: r.y, z: r.z, m: r.s?.m, emote: r.emote?.e, body: r.body?.translation(), samples: r.samples.length })),
      heading: () => world.heading,
      focus: () => ({ x: world.focus.x, y: world.focus.y, z: world.focus.z }),
      teleport: (x, z) => {
        world.carSkipCrash = performance.now() + 500
        if (useGame.getState().mode === 'car') world.car.setTranslation({ x, y: 1, z }, true)
        else world.player.setTranslation({ x, y: useGame.getState().inside ? world.focus.y + 0.3 : 1.5, z }, true)
      },
      setTime: (hours) => (world.time = hours * 60),
      setWanted: (n) => useGame.setState({ wanted: n }),
      setSignals: (t) => (signals.t = t),
      setRain: (v) => (weather.forced = v),
      rain: () => ({ rain: weather.rain, target: weather.target }),
      hurt: (n) => hurtPlayer(n),
      dogs: () => dogs.map((d) => ({ x: Math.round(d.x), z: Math.round(d.z), state: d.state, flee: d.flee > 0 })),
      pin: () => world.pin && { x: Math.round(world.pin.x), z: Math.round(world.pin.z), name: world.pin.name },
      placeCar: (x, z, yaw) => {
        world.carSkipCrash = performance.now() + 800
        world.car.setTranslation({ x, y: 1, z }, true)
        world.car.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true)
        world.car.setLinvel({ x: 0, y: 0, z: 0 }, true)
      },
      details: () => ({ parks: city.parks, wardens: city.wardens, stopSigns: city.stopSigns, beds: city.flowerBeds }),
      escape: () => ({ seen: world.copsSee, escape: world.escape, lastSeen: world.lastSeen, evading: useGame.getState().evading, wanted: useGame.getState().wanted, message: useGame.getState().message?.text }),
      setShadows: (on) => useGame.setState({ shadows: on }),
      // Point the camera (yaw 0 looks from +z) and hold it there for a while.
      setCamera: (yaw, pitch = 0.3, distance) => Object.assign(world, { cameraYaw: yaw, cameraPitch: pitch, debugCamDistance: distance, lastMouseMove: performance.now() + 60000 }),
      vehicles: () => vehicles.map((v) => ({ type: v.type, state: v.state, x: v.x, z: v.z, speed: v.speed, chasing: v.chasing, officerOut: !!v.officerOut, yaw: v.yaw, blockedBy: v.blockedBy, riders: v.riders?.length ?? 0, dwell: v.dwell, stopWait: v.stopWait })),
      waiting: () => waitingCounts(),
      // Put an NPC danfo on the road just before a bus stop.
      busToStop: (name) => {
        const stop = city.busStops.find((s) => s.name === name)
        const v = vehicles.find((v) => v.type === 'danfo' && v.state === 'lane' && !v.riders.length)
        setLane(v, stop.axis, stop.line, stop.dir, stop.p - stop.dir * 15)
        v.lastStop = null
        window.__bus = v
        window.__stop = stop
        return vehicles.indexOf(v)
      },
      cops: () => npcs.filter((n) => n.kind === 'cop' && n.active).map((n) => ({ x: n.x, z: n.z, grab: n.grab, returning: n.returning })),
      npcs: () => NPCS,
      enterOrExit,
      interact,
      punch,
      // Turn to face the nearest pedestrian, then punch.
      facePunchNearest: () => {
        const n = npcNear(world.focus.x, world.focus.z, 6)
        if (n) world.heading = Math.atan2(n.x + n.ox - world.focus.x, n.z + n.oz - world.focus.z)
        world.forceFacing = world.heading
        punch()
      },
      faceTo: (x, z) => (world.forceFacing = world.heading = Math.atan2(x - world.focus.x, z - world.focus.z)),
      doors: () => city.doors,
      busStops: () => city.busStops,
      riders: () => world.playerVehicle.riders.length,
      setQuest: (quest, step = -1) => useGame.setState({ quest, step }),
      target: () => activeTarget(useGame.getState()),
      race: () => ({ ui: useGame.getState().race, world: world.race && { id: world.race.id, phase: world.race.phase, cp: world.race.cp, joined: world.race.joined, racers: world.race.racers } }),
      raceTarget: () => {
        const m = raceMarkers()
        return m && m.current
      },
      raceStart: (id) => RACES[id].start,
      foodSpots: () => city.foodSpots,
      sideJobs: () => SIDE_JOBS.map((j) => ({ title: j.title, giver: j.giver, pos: NPCS[j.giver].pos })),
      enterRoom: (id) => placeInRoom(id),
      leaveRoom: () => useGame.getState().inside && placeOutside(useGame.getState().inside),
      carHp: () => world.carHp ?? CAR_HP,
      damageCar: (n) => damagePlayerCar(n),
      advanceDialogue: () => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' })),
    }
  }, [])

  return null
}
