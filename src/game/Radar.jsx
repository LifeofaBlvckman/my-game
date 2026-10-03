import { useEffect, useRef } from 'react'
import { mapSpot } from './rooms'
import { RACES } from './racing'
import { city, ISLAND, MAINLAND } from './cityData'
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

// Draw the whole map once, then just rotate and crop it every frame.
function drawMap() {
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
      if (objective) blip(objective.x, objective.z, rot, '#ffd23a', 5.5)
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
    <div className="radar">
      <canvas ref={ref} width={SIZE} height={SIZE} />
    </div>
  )
}
