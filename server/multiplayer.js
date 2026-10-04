import { WebSocketServer } from 'ws'

// Multiplayer relay. Each client simulates its own city (traffic, crowds);
// the server only shares players with each other: where they are, what they
// drive, punches between them, chat, emoji, and the time of day.
// Like Messenger, players are split into rooms: everyone joins the first room
// with space, and a new room opens when they're all full. No database is
// needed: everything lives in memory while people are connected.

const ROOM_SIZE = 16 // players who see each other
// Races: one at a time per room. Someone opens one at a start flag, others
// have LOBBY_MS to join, then the server starts it and keeps the results.
const RACE_ROUTES = new Set(['street', 'beach'])
const LOBBY_MS = 20000
const RACE_MAX_MS = 180000
const MAX_PLAYERS = 256 // per server
const MAX_MESSAGE = 2048
const MAX_RATE = 40 // messages per second per client
const VEHICLE_TYPES = new Set(['sedan', 'police', 'jeep', 'danfo', 'keke', 'benz', 'gwagon', 'sports', 'truck', 'lastma'])
const OUTFIT_ID = /^[a-z0-9-]{1,16}$/
const HEX = /^#[0-9a-f]{6}$/i
const START_MINUTES = 17 * 60

const clean = (text, max) =>
  String(text ?? '')
    .replace(/[^\p{L}\p{N}\p{P}\p{Zs}₦]/gu, '')
    .trim()
    .slice(0, max)
const num = (v, limit) => (Number.isFinite(v) ? Math.max(-limit, Math.min(limit, v)) : 0)
// A player's police chase: a few [x, z, heading(, height)] for others to draw.
const points = (list, max, size) =>
  Array.isArray(list) ? list.slice(0, max).filter(Array.isArray).map((p) => [num(p[0], 1000), num(p[1], 1000), num(p[2], 10), num(p[3], 50)].slice(0, size)) : []

export function attachMultiplayer(httpServer) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE })
  const players = new Map() // everyone connected, by id
  const rooms = new Map() // room number -> Map of players
  const started = Date.now()
  let nextId = 1

  const minutes = () => (START_MINUTES + (Date.now() - started) / 1000) % 1440
  const send = (ws, msg) => ws.readyState === 1 && ws.send(JSON.stringify(msg))
  // Send to everyone in a player's room (except one, usually the sender).
  const broadcast = (room, msg, except) => {
    const data = JSON.stringify(msg)
    for (const p of room.values()) if (p.id !== except && p.ws.readyState === 1) p.ws.send(data)
  }
  const endRace = (room) => {
    if (!room.race) return
    clearTimeout(room.race.timer)
    room.race = null
    broadcast(room, { t: 'race', a: 'end' })
  }
  const goRace = (room) => {
    const race = room.race
    if (!race) return
    race.racers = race.racers.filter((id) => room.has(id))
    if (!race.racers.length) return endRace(room)
    race.started = true
    broadcast(room, { t: 'race', a: 'go', route: race.route, racers: race.racers })
    race.timer = setTimeout(() => endRace(room), RACE_MAX_MS)
  }
  // Everyone still racing has crossed the line (or left): the race is over.
  const checkRaceOver = (room) => {
    const race = room.race
    if (race?.started && race.racers.every((id) => race.finished.includes(id) || !room.has(id))) endRace(room)
  }
  const raceInfo = (race, now) => ({ t: 'race', a: 'open', route: race.route, host: race.host, in: Math.max(0, race.goAt - now), racers: race.racers })
  const joinRoom = (player) => {
    let number = 1
    while (rooms.get(number)?.size >= ROOM_SIZE) number++
    if (!rooms.has(number)) rooms.set(number, new Map())
    player.roomNumber = number
    player.room = rooms.get(number)
    player.room.set(player.id, player)
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
        // The same browser tab reconnecting (after a dropped connection):
        // drop its old connection now, or friends (and you) would briefly see
        // a second copy of you standing where you were.
        player.sid = typeof msg.sid === 'string' ? msg.sid.slice(0, 40) : null
        if (player.sid) {
          for (const old of [...players.values()]) {
            if (old.sid !== player.sid || old === player) continue
            players.delete(old.id)
            old.room.delete(old.id)
            broadcast(old.room, { t: 'leave', id: old.id, name: old.name })
            checkRaceOver(old.room)
            if (!old.room.size) rooms.delete(old.roomNumber)
            old.ws.terminate()
          }
        }
        players.set(player.id, player)
        joinRoom(player)
        send(ws, {
          t: 'welcome',
          id: player.id,
          room: player.roomNumber,
          time: minutes(),
          players: [...player.room.values()].filter((p) => p.id !== player.id).map((p) => ({ id: p.id, name: p.name, s: p.state, o: p.look })),
        })
        broadcast(player.room, { t: 'join', id: player.id, name: player.name }, player.id)
        // A race is waiting for racers: let the newcomer know.
        if (player.room.race && !player.room.race.started) send(ws, raceInfo(player.room.race, Date.now()))
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
          w: Math.max(0, Math.min(5, num(msg.w, 5) | 0)), // wanted stars
          pc: points(msg.pc, 3, 3), // police cars chasing them
          pf: points(msg.pf, 3, 4), // police officers on foot
        }
        broadcast(player.room, { t: 's', id: player.id, ...player.state }, player.id)
      } else if (msg.t === 'hit') {
        // Only allow hits on players who are actually close to the attacker.
        const target = player.room.get(msg.to)
        const a = player.state?.p
        const b = target?.state?.p
        if (!target || !a || !b || Math.hypot(a[0] - b[0], a[2] - b[2]) > 8) return
        send(target.ws, { t: 'hit', from: player.id, dmg: Math.max(0, Math.min(40, num(msg.dmg, 40))), x: a[0], z: a[2] })
      } else if (msg.t === 'chat') {
        const text = clean(msg.text, 120)
        if (text) broadcast(player.room, { t: 'chat', id: player.id, name: player.name, text })
      } else if (msg.t === 'race') {
        const room = player.room
        const race = room.race
        if (msg.a === 'open' && !race && RACE_ROUTES.has(msg.route)) {
          room.race = { route: msg.route, host: player.name, racers: [player.id], finished: [], goAt: now + LOBBY_MS, started: false }
          room.race.timer = setTimeout(() => goRace(room), LOBBY_MS)
          broadcast(room, raceInfo(room.race, now))
        } else if (msg.a === 'join' && race && !race.started && msg.route === race.route && !race.racers.includes(player.id)) {
          race.racers.push(player.id)
          broadcast(room, { t: 'race', a: 'joined', name: player.name, in: Math.max(0, race.goAt - now), racers: race.racers })
        } else if (msg.a === 'leave' && race && race.racers.includes(player.id)) {
          race.racers = race.racers.filter((id) => id !== player.id)
          if (!race.started && !race.racers.length) endRace(room)
          else checkRaceOver(room)
        } else if (msg.a === 'finish' && race?.started && race.racers.includes(player.id) && !race.finished.includes(player.id)) {
          race.finished.push(player.id)
          broadcast(room, { t: 'race', a: 'result', id: player.id, name: player.name, place: race.finished.length, time: Math.max(0, num(msg.time, 600)) })
          checkRaceOver(room)
        }
      } else if (msg.t === 'look') {
        // What someone's wearing (ids from the game's wardrobe).
        const o = msg.o ?? {}
        if (![o.top, o.bottom, o.head].every((v) => OUTFIT_ID.test(v ?? ''))) return
        player.look = { top: o.top, bottom: o.bottom, head: o.head, g: o.g === 'girl' ? 'girl' : 'boy' }
        broadcast(player.room, { t: 'look', id: player.id, o: player.look }, player.id)
      } else if (msg.t === 'roster') {
        // The phone's contacts: everyone online, in any room.
        send(ws, { t: 'roster', players: [...players.values()].filter((p) => p.id !== player.id).map((p) => ({ id: p.id, name: p.name, here: p.room === player.room })) })
      } else if (['dm', 'ring', 'answer', 'hangup', 'pin'].includes(msg.t)) {
        // Phone: texts, calls and shared locations go to one player, anywhere.
        const target = players.get(msg.to)
        if (!target || target === player || now - (player.lastPhone ?? 0) < 250) return
        player.lastPhone = now
        const from = { from: player.id, name: player.name }
        if (msg.t === 'dm') {
          const text = clean(msg.text, 200)
          if (text) send(target.ws, { t: 'dm', ...from, text })
        } else if (msg.t === 'pin') {
          const p = player.state?.p
          if (p) send(target.ws, { t: 'pin', ...from, x: p[0], z: p[2] })
        } else send(target.ws, { t: msg.t, ...from })
      } else if (msg.t === 'emote') {
        // Emoji reactions: an index into the client's list, at most a couple a second.
        const e = num(msg.e, 7) | 0
        if (e < 0 || now - (player.lastEmote ?? 0) < 400) return
        player.lastEmote = now
        broadcast(player.room, { t: 'emote', id: player.id, e }, player.id)
      }
    })

    ws.on('close', () => {
      if (!players.delete(player.id)) return
      player.room.delete(player.id)
      broadcast(player.room, { t: 'leave', id: player.id, name: player.name })
      checkRaceOver(player.room)
      if (!player.room.size) {
        clearTimeout(player.room.race?.timer)
        rooms.delete(player.roomNumber)
      }
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
