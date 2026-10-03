import { WebSocketServer } from 'ws'

// Multiplayer relay. Each client simulates its own city (traffic, crowds);
// the server only shares players with each other: where they are, what they
// drive, punches between them, chat, and the time of day.

const MAX_PLAYERS = 24
const MAX_MESSAGE = 2048
const MAX_RATE = 40 // messages per second per client
const VEHICLE_TYPES = new Set(['sedan', 'police', 'jeep', 'danfo', 'keke'])
const HEX = /^#[0-9a-f]{6}$/i
const START_MINUTES = 17 * 60

const clean = (text, max) =>
  String(text ?? '')
    .replace(/[^\p{L}\p{N}\p{P}\p{Zs}₦]/gu, '')
    .trim()
    .slice(0, max)
const num = (v, limit) => (Number.isFinite(v) ? Math.max(-limit, Math.min(limit, v)) : 0)

export function attachMultiplayer(httpServer) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE })
  const players = new Map()
  const started = Date.now()
  let nextId = 1

  const minutes = () => (START_MINUTES + (Date.now() - started) / 1000) % 1440
  const send = (ws, msg) => ws.readyState === 1 && ws.send(JSON.stringify(msg))
  const broadcast = (msg, except) => {
    const data = JSON.stringify(msg)
    for (const p of players.values()) if (p.id !== except && p.ws.readyState === 1) p.ws.send(data)
  }

  httpServer.on('upgrade', (req, socket, head) => {
    if (!req.url?.startsWith('/mp')) return
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws))
  })

  wss.on('connection', (ws) => {
    if (players.size >= MAX_PLAYERS) {
      send(ws, { t: 'full' })
      return ws.close()
    }
    const player = { id: nextId++, ws, name: null, state: null, alive: true, window: Date.now(), count: 0 }

    ws.on('pong', () => (player.alive = true))
    ws.on('message', (raw) => {
      // Simple rate limit: drop anything over MAX_RATE messages a second.
      const now = Date.now()
      if (now - player.window > 1000) {
        player.window = now
        player.count = 0
      }
      if (++player.count > MAX_RATE) return
      let msg
      try {
        msg = JSON.parse(raw)
      } catch {
        return
      }
      if (!msg || typeof msg !== 'object') return

      if (msg.t === 'hello' && !player.name) {
        player.name = clean(msg.name, 16) || `Player ${player.id}`
        players.set(player.id, player)
        send(ws, {
          t: 'welcome',
          id: player.id,
          time: minutes(),
          players: [...players.values()].filter((p) => p.id !== player.id).map((p) => ({ id: p.id, name: p.name, s: p.state })),
        })
        broadcast({ t: 'join', id: player.id, name: player.name }, player.id)
        return
      }
      if (!player.name) return

      if (msg.t === 's') {
        player.state = {
          // x reaches 2500 because building interiors sit off to the east of the city.
          p: [num(msg.p?.[0], 2500), num(msg.p?.[1], 200), num(msg.p?.[2], 1000)],
          y: num(msg.y, 10),
          m: msg.m === 'c' ? 'c' : 'f',
          c: VEHICLE_TYPES.has(msg.c) ? msg.c : 'sedan',
          k: HEX.test(msg.k) ? msg.k : '#c9ccd1',
          a: num(msg.a, 255) | 0, // animation flags
          u: num(msg.u, 1), // punch progress
        }
        broadcast({ t: 's', id: player.id, ...player.state }, player.id)
      } else if (msg.t === 'hit') {
        // Only allow hits on players who are actually close to the attacker.
        const target = players.get(msg.to)
        const a = player.state?.p
        const b = target?.state?.p
        if (!target || !a || !b || Math.hypot(a[0] - b[0], a[2] - b[2]) > 8) return
        send(target.ws, { t: 'hit', from: player.id, dmg: Math.max(0, Math.min(40, num(msg.dmg, 40))), x: a[0], z: a[2] })
      } else if (msg.t === 'chat') {
        const text = clean(msg.text, 120)
        if (text) broadcast({ t: 'chat', id: player.id, name: player.name, text })
      }
    })

    ws.on('close', () => {
      if (players.delete(player.id)) broadcast({ t: 'leave', id: player.id, name: player.name })
    })
  })

  // Drop connections that stop answering.
  const heartbeat = setInterval(() => {
    for (const p of players.values()) {
      if (!p.alive) {
        p.ws.terminate()
        continue
      }
      p.alive = false
      p.ws.ping()
    }
  }, 15000)
  httpServer.on('close', () => clearInterval(heartbeat))

  return wss
}
