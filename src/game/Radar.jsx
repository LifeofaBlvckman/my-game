import { useEffect, useRef } from 'react'
import { mapSpot } from './rooms'
import { RACES } from './racing'
import { city, ISLAND, MAINLAND, zoneAt } from './cityData'
import { WORLD } from './City'
import { vehicles } from './trafficSim'
import { useGame, world } from './state'

const SIZE = 170 // px on screen
const SCALE = 0.75 // px per meter
const MAP_PX = 2 // offscreen map resolution, px per meter
const MARGIN = 60
const MAP = { x0: WORLD.minX - MARGIN, z0: WORLD.minZ - MARGIN, w: WORLD.maxX - WORLD.minX + MARGIN * 2, d: WORLD.maxZ - WORLD.minZ + MARGIN * 2 }
const OCEAN = '#3f9fb2'
const RIM = SIZE / 2 - 9

// Places worth finding, drawn as round icons: your house, the hospital, the
// police station and the army barracks (and anything you've bought).
const door = (id) => city.doors.find((d) => d.id === id)
export function mapPlaces(game) {
  const list = [
    { at: door('home'), glyph: '⌂', bg: '#2f8a3a', label: 'Your house', pin: true },
    { at: door('hospital'), glyph: '+', bg: '#ffffff', fg: '#d0202a', label: 'Hospital' },
    { at: door('police'), glyph: '★', bg: '#1b2a52', label: 'Police station' },
    city.barracks && { at: { x: city.barracks.gateX, z: city.barracks.gateZ }, glyph: '▲', bg: '#4b5536', label: 'Army barracks' },
    { at: door('bank'), glyph: '₦', bg: '#d4af37', fg: '#1b1b24', label: 'Bank' },
  ]
  for (const p of city.properties) {
    if (game.properties.includes(p.id)) list.push({ at: p, glyph: p.kind === 'garage' ? 'G' : '⌂', bg: '#2ad15a', fg: '#0e3b1a', label: p.kind === 'garage' ? 'Your garage' : 'Your place' })
  }
  return list.filter((p) => p && p.at)
}

// One icon: a round badge with a symbol.
export function drawIcon(ctx, x, y, p, r = 8) {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = p.bg
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = '#111'
  ctx.stroke()
  ctx.fillStyle = p.fg ?? '#ffffff'
  ctx.font = `bold ${Math.round(r * 1.45)}px Arial, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(p.glyph, x, y + 1)
}

// Draw the whole map once, then just rotate and crop it every frame.
export function drawMap() {
  const canvas = document.createElement('canvas')
  canvas.width = MAP.w * MAP_PX
  canvas.height = MAP.d * MAP_PX
  const ctx = canvas.getContext('2d')
  ctx.scale(MAP_PX, MAP_PX)
  ctx.translate(-MAP.x0, -MAP.z0)
  const rect = (r, color) => {
    ctx.fillStyle = color
    ctx.fillRect(r.minX, r.minZ, r.maxX - r.minX, r.maxZ - r.minZ)
  }
  ctx.fillStyle = OCEAN
  ctx.fillRect(MAP.x0, MAP.z0, MAP.w, MAP.d)
  rect({ minX: WORLD.minX, maxX: MAINLAND.maxX, minZ: WORLD.minZ, maxZ: WORLD.maxZ }, '#e2cf98')
  rect({ minX: ISLAND.minX, maxX: WORLD.maxX, minZ: WORLD.minZ, maxZ: WORLD.maxZ }, '#e2cf98')
  rect(MAINLAND, '#2e2f33')
  rect(ISLAND, '#2e2f33')
  ctx.fillStyle = '#2e2f33'
  city.bridges.forEach((b) => ctx.fillRect(b.x0, b.z - 7, b.x1 - b.x0, 14))
  city.blocks.forEach((b) => {
    ctx.fillStyle = b.color === '#a8784c' ? '#9a6d45' : '#7d7f73'
    ctx.fillRect(b.x - b.w / 2, b.z - b.d / 2, b.w, b.d)
  })
  ctx.fillStyle = '#5f8a3c'
  city.parks.forEach((p) => ctx.fillRect(p.x - p.w / 2, p.z - p.d / 2, p.w, p.d))
  ctx.fillStyle = '#a5a79c'
  city.buildings.forEach((b) => ctx.fillRect(b.x - b.w / 2, b.z - b.d / 2, b.w, b.d))
  city.solids.filter((s) => s.collider && !s.hidden).forEach((s) => ctx.fillRect(s.x - s.w / 2, s.z - s.d / 2, s.w, s.d))
  ctx.fillStyle = '#f2b705'
  city.busStops.forEach((b) => ctx.fillRect(b.x - 2, b.z - 2, 4, 4))
  return canvas
}

export default function Radar() {
  const ref = useRef()

  useEffect(() => {
    const map = drawMap()
    const ctx = ref.current.getContext('2d')
    let frame

    // Where a world position lands on the radar (clamped to the rim).
    const project = (x, z, rot) => {
      const dx = (x - world.focus.x) * SCALE
      const dz = (z - world.focus.z) * SCALE
      let px = dx * Math.cos(rot) - dz * Math.sin(rot)
      let py = dx * Math.sin(rot) + dz * Math.cos(rot)
      const d = Math.hypot(px, py)
      const off = d > RIM
      if (off) {
        px *= RIM / d
        py *= RIM / d
      }
      return { x: SIZE / 2 + px, y: SIZE / 2 + py, off }
    }

    // Blip at a world position; clamped to the rim when it's off the radar.
    const blip = (x, z, rot, color, size, square) => {
      let dx = (x - world.focus.x) * SCALE
      let dz = (z - world.focus.z) * SCALE
      const c = Math.cos(rot)
      const s = Math.sin(rot)
      let px = dx * c - dz * s
      let py = dx * s + dz * c
      const d = Math.hypot(px, py)
      if (d > RIM) {
        px *= RIM / d
        py *= RIM / d
      }
      ctx.fillStyle = color
      ctx.strokeStyle = '#000'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      if (square) ctx.rect(SIZE / 2 + px - size, SIZE / 2 + py - size, size * 2, size * 2)
      else ctx.arc(SIZE / 2 + px, SIZE / 2 + py, size, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }

    const draw = () => {
      frame = requestAnimationFrame(draw)
      const { focus, cameraYaw, heading, car, objective } = world
      const game = useGame.getState()
      // Rotate so "up" on the radar is the direction the camera faces.
      const rot = -Math.PI / 2 - Math.atan2(-Math.cos(cameraYaw), -Math.sin(cameraYaw))

      ctx.save()
      ctx.beginPath()
      ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 3, 0, Math.PI * 2)
      ctx.clip()
      ctx.fillStyle = OCEAN
      ctx.fillRect(0, 0, SIZE, SIZE)

      ctx.save()
      ctx.translate(SIZE / 2, SIZE / 2)
      ctx.rotate(rot)
      ctx.scale(SCALE, SCALE)
      ctx.translate(-focus.x, -focus.z)
      ctx.drawImage(map, MAP.x0, MAP.z0, MAP.w, MAP.d)
      ctx.restore()

      if (car && game.mode === 'foot') {
        const c = car.translation()
        blip(c.x, c.z, rot, '#4fa3ff', 3.5, true)
      }
      if (game.wanted > 0) {
        const flash = Math.floor(performance.now() / 250) % 2 === 0
        vehicles.forEach((v) => v.chasing && blip(v.x, v.z, rot, flash ? '#ff3030' : '#3060ff', 3.5))
      }
      // A LASTMA patrol after you: flashing amber.
      for (const v of vehicles) if (v.lastmaOn) blip(v.x, v.z, rot, Math.floor(performance.now() / 300) % 2 ? '#ffb31a' : '#6b1f2e', 3.5)
      if (objective) blip(objective.x, objective.z, rot, '#ffd23a', 5.5)
      // Home, hospital, police, barracks and what you own. Home stays pinned
      // to the rim so you can always find your way back.
      for (const p of mapPlaces(game)) {
        const at = project(p.at.x, p.at.z, rot)
        if (at.off && !p.pin) continue
        drawIcon(ctx, at.x, at.y, p, at.off ? 6 : 7.5)
      }
      // Race start flags: chequered squares.
      for (const race of Object.values(RACES)) blip(race.start.x, race.start.z, rot, game.race?.phase === 'lobby' && !game.race.joined ? '#ffd23a' : '#ffffff', 3.5, true)
      // Friends online: pink dots, pinned to the rim when far away. Someone
      // indoors shows at their building's door.
      for (const r of world.net?.remotes.values() ?? []) {
        if (!r.s) continue
        const spot = mapSpot(r.x, r.z)
        // A friend on the run flashes red and blue, with their police behind.
        const flash = r.s.w > 0 && Math.floor(performance.now() / 250) % 2 === 0
        for (const c of r.s.pc ?? []) blip(c[0], c[1], rot, flash ? '#3060ff' : '#ff3030', 3)
        blip(spot.x, spot.z, rot, r.s.w > 0 ? (flash ? '#ff3030' : '#3060ff') : '#ff6fd0', 5)
      }
      // A location a friend sent from their phone: a flashing pink square.
      if (world.pin && performance.now() < world.pin.until && Math.floor(performance.now() / 400) % 2) blip(world.pin.x, world.pin.z, rot, '#ff6fd0', 6, true)

      // Player arrow.
      ctx.translate(SIZE / 2, SIZE / 2)
      ctx.rotate(rot + Math.atan2(Math.cos(heading), Math.sin(heading)))
      ctx.fillStyle = '#fff'
      ctx.strokeStyle = '#000'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(9, 0)
      ctx.lineTo(-6, 6)
      ctx.lineTo(-3, 0)
      ctx.lineTo(-6, -6)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    }
    draw()
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div className="radar" onPointerDown={(e) => (e.stopPropagation(), useGame.setState({ mapOpen: true }))} title="Map (N)">
      <canvas ref={ref} width={SIZE} height={SIZE} />
    </div>
  )
}

// The whole city, north up, with every icon named (tap the radar or press N).
export function BigMap() {
  const ref = useRef()
  useEffect(() => {
    const map = drawMap()
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    let frame
    const draw = () => {
      frame = requestAnimationFrame(draw)
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      if (canvas.width !== Math.round(w * dpr)) {
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
      }
      const k = Math.min(w / MAP.w, h / MAP.d)
      const ox = (w - MAP.w * k) / 2
      const oy = (h - MAP.d * k) / 2
      const toScreen = (x, z) => ({ x: ox + (x - MAP.x0) * k, y: oy + (z - MAP.z0) * k })
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = OCEAN
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(map, ox, oy, MAP.w * k, MAP.d * k)
      const game = useGame.getState()
      // District names.
      ctx.font = 'bold 12px Arial, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillStyle = 'rgba(255,255,255,0.75)'
      for (const [name, x, z] of DISTRICTS) {
        const p = toScreen(x, z)
        ctx.fillText(name, p.x, p.y)
      }
      if (world.objective) {
        const p = toScreen(world.objective.x, world.objective.z)
        ctx.beginPath()
        ctx.arc(p.x, p.y, 7, 0, Math.PI * 2)
        ctx.fillStyle = '#ffd23a'
        ctx.fill()
        ctx.strokeStyle = '#111'
        ctx.stroke()
      }
      for (const pl of mapPlaces(game)) {
        const p = toScreen(pl.at.x, pl.at.z)
        drawIcon(ctx, p.x, p.y, pl, 10)
      }
      for (const r of world.net?.remotes.values() ?? []) {
        if (!r.s) continue
        const spot = mapSpot(r.x, r.z)
        const p = toScreen(spot.x, spot.z)
        ctx.beginPath()
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2)
        ctx.fillStyle = '#ff6fd0'
        ctx.fill()
        ctx.stroke()
      }
      // You.
      const me = mapSpot(world.focus.x, world.focus.z)
      const p = toScreen(me.x, me.z)
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(Math.atan2(Math.cos(world.heading), Math.sin(world.heading)))
      ctx.fillStyle = '#fff'
      ctx.strokeStyle = '#000'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(12, 0)
      ctx.lineTo(-8, 8)
      ctx.lineTo(-4, 0)
      ctx.lineTo(-8, -8)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    }
    draw()
    const onKey = (e) => (e.code === 'Escape' || e.code === 'KeyN') && useGame.setState({ mapOpen: false })
    window.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('keydown', onKey)
    }
  }, [])
  const legend = mapPlaces(useGame.getState())
  return (
    <div className="bigmap" onPointerDown={(e) => e.target === e.currentTarget && useGame.setState({ mapOpen: false })}>
      <div className="bigmap-sheet">
        <div className="panel-head">
          <h2>Lagos</h2>
          <button className="panel-close" onClick={() => useGame.setState({ mapOpen: false })} aria-label="Close">
            ✕
          </button>
        </div>
        <canvas ref={ref} className="bigmap-canvas" />
        <div className="bigmap-legend">
          {legend.map((p) => (
            <span key={p.label}>
              <i style={{ background: p.bg, color: p.fg ?? '#fff' }}>{p.glyph}</i>
              {p.label}
            </span>
          ))}
          <span>
            <i style={{ background: '#ffd23a' }} />
            Next job
          </span>
          <span>
            <i style={{ background: '#ff6fd0' }} />
            Friends
          </span>
        </div>
      </div>
    </div>
  )
}

// District names for the big map, each at the middle of its blocks.
const DISTRICTS = (() => {
  const sums = new Map()
  for (const b of city.blocks) {
    const name = zoneAt(b.x, b.z)
    const t = sums.get(name) ?? { x: 0, z: 0, n: 0 }
    t.x += b.x
    t.z += b.z
    t.n += 1
    sums.set(name, t)
  }
  const list = [...sums].map(([name, t]) => [name, t.x / t.n, t.z / t.n])
  list.push(['LAGOS LAGOON', (MAINLAND.maxX + ISLAND.minX) / 2, -20])
  return list
})()
