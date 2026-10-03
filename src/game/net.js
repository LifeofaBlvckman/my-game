import { hurtPlayer } from './damage'
import { fx } from './particles'
import { useGame, world } from './state'
import { onRaceMessage } from './racing'
import { phoneMessage } from './phoneline'
import { cleanOutfit } from './wardrobe'

// Client side of multiplayer. Connects to the server on the same address the
// game was loaded from; if there isn't one, the game just stays single player.

const SEND_EVERY = 1000 / 12 // state updates per second
const INTERP_DELAY = 120 // ms behind real time, so there are two samples to blend
export const FLAGS = { moving: 1, run: 2, down: 4, air: 8 }

let chatKey = 0
export function addChat(name, text, system = false) {
  const chat = [...useGame.getState().chat, { key: ++chatKey, name, text, system, at: Date.now() }].slice(-8)
  useGame.setState({ chat })
}

const syncRoster = (net) => useGame.setState({ remotes: [...net.remotes.keys()], players: net.remotes.size + 1 })

const setLook = (id, o) => {
  if (!o) return
  const g = o.g === 'girl' ? 'girl' : 'boy'
  useGame.setState({ remoteLooks: { ...useGame.getState().remoteLooks, [id]: { ...cleanOutfit(o, g), g } } })
}

function addRemote(net, id, name, s) {
  net.remotes.set(id, { id, name, samples: s ? [{ time: performance.now(), ...s }] : [], x: s?.p[0] ?? 0, y: s?.p[1] ?? -500, z: s?.p[2] ?? 0 /* parked out of the way until their first update */, yaw: s?.y ?? 0, s })
}

// If the connection drops (the server restarted after an update, a free
// server woke up, the phone slept), keep trying to get back online.
let retryTimer = null
let retryDelay = 2000
let full = false
function scheduleReconnect(name) {
  if (retryTimer || full) return
  retryTimer = setTimeout(() => {
    retryTimer = null
    connectMultiplayer(name)
  }, retryDelay)
  retryDelay = Math.min(30000, retryDelay * 2)
}

export function connectMultiplayer(name) {
  if (world.net || typeof WebSocket === 'undefined') return world.net
  if (!connectMultiplayer.watching) {
    // New clothes: show them to everyone.
    useGame.subscribe((s, prev) => (s.outfit !== prev.outfit || s.gender !== prev.gender) && world.net?.look(s.outfit))
    // Coming back to the tab: reconnect straight away.
    connectMultiplayer.watching = true
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || world.net || full) return
      clearTimeout(retryTimer)
      retryTimer = null
      connectMultiplayer(name)
    })
  }
  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/mp`
  let ws
  try {
    ws = new WebSocket(url)
  } catch {
    scheduleReconnect(name)
    return null
  }

  const net = {
    id: null,
    ws,
    remotes: new Map(),
    lastSend: 0,
    send(msg) {
      if (ws.readyState === 1) ws.send(JSON.stringify(msg))
    },
    sendState(state) {
      const now = performance.now()
      if (now - net.lastSend < SEND_EVERY) return
      net.lastSend = now
      net.send({ t: 's', ...state })
    },
    hit(id, dmg) {
      net.send({ t: 'hit', to: id, dmg: Math.round(dmg) })
    },
    chat(text) {
      net.send({ t: 'chat', text })
    },
    emote(e) {
      net.send({ t: 'emote', e })
    },
    // What you're wearing, and boy or girl.
    look(o) {
      net.send({ t: 'look', o: { ...o, g: useGame.getState().gender } })
    },
    // A punch landing at (px, pz): did it hit another player on foot?
    punchPlayers(px, pz) {
      for (const r of net.remotes.values()) {
        if (r.s?.m === 'f' && Math.hypot(r.x - px, r.z - pz) < 1) {
          net.hit(r.id, 10)
          return true
        }
      }
      return false
    },
    // Where a remote player should be drawn right now.
    sample(r) {
      const time = performance.now() - INTERP_DELAY
      const list = r.samples
      if (!list.length) return
      let a = list[0]
      let b = list[list.length - 1]
      for (let i = 0; i < list.length - 1; i++) {
        if (list[i].time <= time && list[i + 1].time >= time) {
          a = list[i]
          b = list[i + 1]
          break
        }
      }
      const span = b.time - a.time
      const k = span > 0 ? Math.min(1, Math.max(0, (time - a.time) / span)) : 1
      r.x = a.p[0] + (b.p[0] - a.p[0]) * k
      r.y = a.p[1] + (b.p[1] - a.p[1]) * k
      r.z = a.p[2] + (b.p[2] - a.p[2]) * k
      r.yaw = a.y + Math.atan2(Math.sin(b.y - a.y), Math.cos(b.y - a.y)) * k
      r.s = b
    },
  }

  ws.onopen = () => net.send({ t: 'hello', name })
  ws.onmessage = (e) => {
    let msg
    try {
      msg = JSON.parse(e.data)
    } catch {
      return
    }
    if (msg.t === 'welcome') {
      retryDelay = 2000
      net.id = msg.id
      world.time = msg.time
      msg.players.forEach((p) => {
        addRemote(net, p.id, p.name, p.s)
        setLook(p.id, p.o)
      })
      useGame.setState({ online: true })
      net.look(useGame.getState().outfit)
      syncRoster(net)
      const where = msg.room > 1 ? ` (room ${msg.room})` : ''
      addChat(null, msg.players.length ? `Online${where}. ${msg.players.length} other player${msg.players.length > 1 ? 's' : ''} here.` : `Online${where}. Share this address with friends so they can join.`, true)
    } else if (msg.t === 'join') {
      addRemote(net, msg.id, msg.name)
      syncRoster(net)
      addChat(null, `${msg.name} joined. They're the pink dot on your radar.`, true)
    } else if (msg.t === 'leave') {
      net.remotes.delete(msg.id)
      syncRoster(net)
      addChat(null, `${msg.name} left`, true)
    } else if (msg.t === 's') {
      const r = net.remotes.get(msg.id)
      if (!r) return
      r.samples.push({ time: performance.now(), ...msg })
      if (r.samples.length > 5) r.samples.shift()
    } else if (msg.t === 'hit') {
      const from = net.remotes.get(msg.from)
      hurtPlayer(msg.dmg, msg.x, msg.z, msg.dmg >= 15)
      if (from && msg.dmg >= 15) fx.shake(0.4)
    } else if (msg.t === 'chat') {
      addChat(msg.name, msg.text)
    } else if (msg.t === 'race') {
      onRaceMessage(msg, net.id)
    } else if (msg.t === 'emote') {
      const r = net.remotes.get(msg.id)
      if (r) r.emote = { e: msg.e, at: performance.now() }
    } else if (msg.t === 'look') {
      setLook(msg.id, msg.o)
    } else if (['roster', 'dm', 'ring', 'answer', 'hangup', 'pin'].includes(msg.t)) {
      phoneMessage(msg)
    } else if (msg.t === 'full') {
      full = true
      addChat(null, 'The server is full, so you are playing offline.', true)
    }
  }
  ws.onclose = () => {
    const wasOnline = useGame.getState().online
    if (world.net === net) world.net = null
    useGame.setState({ online: false, players: 1, remotes: [] })
    // An online race can't finish without the server.
    if (world.race?.online) {
      world.race = null
      world.raceHold = false
      useGame.setState({ race: null })
    }
    if (wasOnline) addChat(null, 'Lost the connection. Reconnecting...', true)
    scheduleReconnect(name)
  }
  world.net = net
  return net
}
