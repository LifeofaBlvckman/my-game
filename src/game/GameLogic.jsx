import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useKeyboardControls } from '@react-three/drei'
import { Quaternion, Vector3 } from 'three'
import { city, zoneAt } from './cityData'
import { swapWithPlayerCar, vehicles } from './trafficSim'
import { npcNear, npcs, punchNpc } from './crowd'
import { CHATTER, currentTarget, NPCS, QUESTS, STRANGER_LINES } from './quests'
import { VEHICLES } from './vehicleTypes'
import { bust, clang, honk, jingle, punchSound, setHorn, setMusic, setSiren, swoosh, thud } from './audio'
import { CAR_HP, damagePlayerCar, damageVehicle, hurtPlayer } from './damage'
import { fx } from './particles'
import { useGame, world } from './state'

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
  world.calm = 0
}

function advanceQuest() {
  const { quest, step, money } = useGame.getState()
  const q = QUESTS[quest]
  if (!q) return
  if (step < 0) {
    useGame.setState({ step: 0 })
    banner(`NEW JOB: ${q.title.toUpperCase()}`)
  } else if (step < q.steps.length - 1) {
    useGame.setState({ step: step + 1 })
  } else {
    useGame.setState({ quest: quest + 1, step: -1, money: money + q.reward })
    jingle()
    message(quest + 1 >= QUESTS.length ? `ALL JOBS DONE!\nEKO O NI BAJE!` : `JOB DONE!\n${naira(q.reward)}`, '#7ee07e', 4500)
  }
}

function nearestVehicle(from) {
  let best = null
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
    const d = Math.hypot(n.pos[0] - from.x, n.pos[1] - from.z)
    if (d < TALK_DISTANCE && (!best || d < best.d)) best = { id, n, d }
  }
  return best
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
    // Carjacking: the traffic vehicle and the player's car swap places.
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
  if (game.phase !== 'playing' || game.dialogue || game.mode !== 'foot' || game.chatOpen) return
  // The key press that closed a dialogue shouldn't open a new one.
  if (performance.now() - (world.dialogueClosedAt ?? 0) < 400) return
  const near = nearestNamedNpc(world.focus)
  if (near) {
    const target = currentTarget(game.quest, game.step)
    if (target?.npc === near.id) {
      const q = QUESTS[game.quest]
      openDialogue(game.step < 0 ? q.start : q.steps[game.step].talk, advanceQuest)
    } else {
      openDialogue([{ speaker: near.n.name, text: CHATTER[Math.floor(Math.random() * CHATTER.length)] }])
    }
    return
  }
  // Anyone else on the street just says something short.
  let best = null
  let bestD = 2.2
  for (const n of npcs) {
    const d = Math.hypot(n.x - world.focus.x, n.z - world.focus.z)
    if (d < bestD && n.down <= 0) {
      best = n
      bestD = d
    }
  }
  if (best) {
    if (best.kind !== 'walk') best.yaw = Math.atan2(world.focus.x - best.x, world.focus.z - best.z)
    const who = best.role === 'trader' || best.role === 'seller' ? 'Trader' : best.role === 'bouncer' ? 'Bouncer' : 'Passer-by'
    const text = best.role === 'bouncer' ? 'You no dey the list. Comot.' : best.role === 'trader' || best.role === 'seller' ? 'Customer! Come buy, I go do you good price.' : STRANGER_LINES[Math.floor(Math.random() * STRANGER_LINES.length)]
    useGame.setState({ subtitle: { speaker: who, text, key: ++bannerKey } })
    const key = bannerKey
    setTimeout(() => useGame.getState().subtitle?.key === key && useGame.setState({ subtitle: null }), 2500)
  }
}

function policeNearby(radius = 45) {
  return vehicles.some((v) => v.police && flat(v, world.focus) < radius)
}

export function resetPlayerCar() {
  world.carWrecked = false
  world.carBurning = 0
  world.carHp = CAR_HP
  world.carSkipCrash = performance.now() + 500
  q.setFromAxisAngle(up, Math.PI)
  world.car.setTranslation({ x: city.carSpawn[0], y: city.carSpawn[1], z: city.carSpawn[2] }, true)
  world.car.setRotation(q, true)
  world.car.setLinvel({ x: 0, y: 0, z: 0 }, true)
  useGame.setState({ carType: 'sedan', carColor: '#c9ccd1' })
}

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
      if (!v.wrecked && v.state !== 'parked') honk()
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
  const game = useGame.getState()
  if (game.wasted || game.busted) return
  useGame.setState({ wasted: true, dialogue: null })
  bust()
  message('WASTED', '#e8343a', 3200)
  setTimeout(() => {
    if (useGame.getState().mode === 'car') exitCar()
    world.playerDown = 0
    world.player.setTranslation({ x: city.spawn[0], y: city.spawn[1], z: city.spawn[2] }, true)
    world.player.setLinvel({ x: 0, y: 0, z: 0 }, true)
    if (world.carWrecked) resetPlayerCar()
    const { money } = useGame.getState()
    useGame.setState({ wasted: false, wanted: 0, health: 100, money: Math.max(0, money - 500) })
  }, 3000)
}

function getBusted() {
  const game = useGame.getState()
  if (game.busted) return
  useGame.setState({ busted: true, dialogue: null })
  bust()
  message('BUSTED', '#5aa0ff', 3200)
  setTimeout(() => {
    if (useGame.getState().mode === 'car') exitCar()
    world.player.setTranslation({ x: city.spawn[0], y: city.spawn[1], z: city.spawn[2] }, true)
    world.player.setLinvel({ x: 0, y: 0, z: 0 }, true)
    const { money } = useGame.getState()
    if (world.carWrecked) resetPlayerCar()
    useGame.setState({ busted: false, wanted: 0, health: 100, money: Math.max(0, money - 1000) })
  }, 3000)
}

export default function GameLogic() {
  const [subscribeKeys] = useKeyboardControls()
  const timers = useRef({ hud: 0, zone: 0, hitCooldown: 0, ramCooldown: 0, busting: 0 })

  useEffect(() => {
    const subs = [
      subscribeKeys((s) => s.enter, (p) => p && enterOrExit()),
      subscribeKeys((s) => s.interact, (p) => p && interact()),
      subscribeKeys((s) => s.horn, (p) => setHorn(p && useGame.getState().mode === 'car' && !useGame.getState().chatOpen)),
    ]
    const onMouse = (e) => e.button === 0 && document.pointerLockElement && punch()
    window.addEventListener('mousedown', onMouse)
    const onKey = (e) => {
      const game = useGame.getState()
      if (game.chatOpen || e.target instanceof HTMLInputElement) return
      if (e.code === 'KeyY' && game.phase === 'playing') {
        e.preventDefault()
        document.exitPointerLock?.()
        useGame.setState({ chatOpen: true })
        return
      }
      if (e.code === 'KeyX') punch()
      if (e.code === 'KeyM') {
        setMusic(!game.music)
        useGame.setState({ music: !game.music })
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
    for (const v of vehicles) if (v.chasing) nearestCop = Math.min(nearestCop, flat(v, world.focus))
    setSiren(game.wanted > 0 ? Math.max(0, 1 - nearestCop / 120) : 0)
    if (game.wanted > 0) {
      const slow = game.mode === 'foot' || Math.abs(world.carSpeed) < 3
      t.busting = nearestCop < 5.5 && slow ? t.busting + dt : Math.max(0, t.busting - dt)
      if (t.busting > 1.5) {
        t.busting = 0
        getBusted()
      }
      world.calm = nearestCop < 70 ? 0 : (world.calm ?? 0) + dt
      if (world.calm > 18) {
        world.calm = 0
        useGame.setState({ wanted: game.wanted - 1 })
      }
    }

    // Driving to a checkpoint.
    const target = currentTarget(game.quest, game.step)
    world.objective = target ? { x: target.x, z: target.z } : null
    if (target?.goto && !game.dialogue && Math.hypot(target.x - world.focus.x, target.z - world.focus.z) < 6 && (!target.vehicle || game.mode === 'car')) {
      openDialogue(QUESTS[game.quest].steps[game.step].talk, advanceQuest)
    }

    t.zone += dt
    if (t.zone > 0.5) {
      t.zone = 0
      const zone = zoneAt(world.focus.x, world.focus.z)
      if (zone !== game.zone) {
        useGame.setState({ zone })
        banner(zone)
      }
    }

    t.hud += dt
    if (t.hud < 0.1) return
    t.hud = 0
    const kmh = Math.round(Math.abs(world.carSpeed ?? 0) * 3.6)
    let prompt = null
    if (game.mode === 'foot' && !game.dialogue) {
      const npc = nearestNamedNpc(world.focus)
      const car = !npc && nearestVehicle(world.focus)
      if (npc) prompt = `Press E to talk to ${npc.n.name}`
      else if (car?.wrecked) prompt = 'This car is wrecked. Find another one.'
      else if (car) prompt = `Press F to ${car.own ? 'enter' : 'jack'} the ${VEHICLES[car.type].name}`
    }
    const carHp = Math.round(world.carHp ?? CAR_HP)
    if (kmh !== game.speed || prompt !== game.prompt || carHp !== game.carHp) useGame.setState({ speed: kmh, prompt, carHp })
  })

  // Debug hooks for automated testing (dev server only).
  useEffect(() => {
    if (!import.meta.env.DEV) return
    window.__game = {
      state: () => useGame.getState(),
      focus: () => ({ x: world.focus.x, y: world.focus.y, z: world.focus.z }),
      teleport: (x, z) => {
        world.carSkipCrash = performance.now() + 500
        if (useGame.getState().mode === 'car') world.car.setTranslation({ x, y: 1, z }, true)
        else world.player.setTranslation({ x, y: 1.5, z }, true)
      },
      setTime: (hours) => (world.time = hours * 60),
      setWanted: (n) => useGame.setState({ wanted: n }),
      vehicles: () => vehicles.map((v) => ({ type: v.type, state: v.state, x: v.x, z: v.z, speed: v.speed, chasing: v.chasing })),
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
      carHp: () => world.carHp ?? CAR_HP,
      damageCar: (n) => damagePlayerCar(n),
      advanceDialogue: () => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' })),
    }
  }, [])

  return null
}
