import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useKeyboardControls } from '@react-three/drei'
import { Quaternion, Vector3 } from 'three'
import { city, zoneAt } from './cityData'
import { swapWithPlayerCar, vehicles } from './traffic'
import { npcs } from './pedestrians'
import { CHATTER, currentTarget, NPCS, QUESTS, STRANGER_LINES } from './quests'
import { VEHICLES } from './vehicleTypes'
import { bust, jingle, setHorn, setMusic, setSiren, thud } from './audio'
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
    if (d < ENTER_DISTANCE) best = { own: true, d, type: useGame.getState().carType }
  }
  for (const v of vehicles) {
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
  useGame.setState({ mode: 'foot' })
}

function enterOrExit() {
  const game = useGame.getState()
  if (game.phase !== 'playing' || game.dialogue || game.busted || !world.player || !world.car) return
  if (game.mode === 'car') return exitCar()

  const target = nearestVehicle(world.focus)
  if (!target) return
  if (!target.own) {
    // Carjacking: the traffic vehicle and the player's car swap places.
    const t = world.car.translation()
    const taken = swapWithPlayerCar(target.v, { type: game.carType, color: game.carColor, x: t.x, z: t.z, yaw: world.carHeading ?? 0 })
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
  if (game.phase !== 'playing' || game.dialogue || game.mode !== 'foot') return
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
    useGame.setState({ busted: false, wanted: 0, money: Math.max(0, money - 1000) })
  }, 3000)
}

export default function GameLogic() {
  const [subscribeKeys] = useKeyboardControls()
  const timers = useRef({ hud: 0, zone: 0, hitCooldown: 0, ramCooldown: 0, busting: 0 })

  useEffect(() => {
    const subs = [
      subscribeKeys((s) => s.enter, (p) => p && enterOrExit()),
      subscribeKeys((s) => s.interact, (p) => p && interact()),
      subscribeKeys((s) => s.horn, (p) => setHorn(p && useGame.getState().mode === 'car')),
    ]
    const onKey = (e) => {
      const game = useGame.getState()
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
    }
  }, [subscribeKeys])

  useFrame((_, rawDt) => {
    if (!world.player || !world.car) return
    const dt = Math.min(rawDt, 0.1)
    const t = timers.current
    const game = useGame.getState()
    if (game.phase !== 'playing') return

    // Knocking people down and ramming the police get you wanted.
    t.hitCooldown -= dt
    t.ramCooldown -= dt
    while (world.events.length) {
      const e = world.events.shift()
      if (e.type === 'pedHit') {
        thud()
        if (t.hitCooldown <= 0) {
          addWanted(1)
          t.hitCooldown = 2
        }
      }
    }
    const carPos = world.car.translation()
    if (game.mode === 'car' && Math.abs(world.carSpeed) > 6 && t.ramCooldown <= 0) {
      const rammed = vehicles.some((v) => v.police && flat(v, carPos) < 3.4)
      if (rammed) {
        thud()
        addWanted(1)
        t.ramCooldown = 3
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
      else if (car) prompt = `Press F to ${car.own ? 'enter' : 'jack'} the ${VEHICLES[car.type].name}`
    }
    if (kmh !== game.speed || prompt !== game.prompt) useGame.setState({ speed: kmh, prompt })
  })

  // Debug hooks for automated testing (dev server only).
  useEffect(() => {
    if (!import.meta.env.DEV) return
    window.__game = {
      state: () => useGame.getState(),
      focus: () => ({ x: world.focus.x, y: world.focus.y, z: world.focus.z }),
      teleport: (x, z) => {
        if (useGame.getState().mode === 'car') world.car.setTranslation({ x, y: 1, z }, true)
        else world.player.setTranslation({ x, y: 1.5, z }, true)
      },
      setTime: (hours) => (world.time = hours * 60),
      setWanted: (n) => useGame.setState({ wanted: n }),
      vehicles: () => vehicles.map((v) => ({ type: v.type, state: v.state, x: v.x, z: v.z, speed: v.speed, chasing: v.chasing })),
      npcs: () => NPCS,
      enterOrExit,
      interact,
      advanceDialogue: () => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' })),
    }
  }, [])

  return null
}
