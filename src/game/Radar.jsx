import { useEffect, useRef } from 'react'
import { city, CELL, GRID, ROAD } from './cityData'
import { world } from './state'

const SIZE = 170 // px on screen
const SCALE = 0.75 // px per meter
const MAP_PX = 2 // offscreen map resolution, px per meter
const EXTENT = GRID * CELL + ROAD + 80
const OCEAN = '#3c6f8c'

// Draw the whole map once, then just rotate and crop it every frame.
function drawMap() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = EXTENT * MAP_PX
  const ctx = canvas.getContext('2d')
  ctx.scale(MAP_PX, MAP_PX)
  ctx.translate(EXTENT / 2, EXTENT / 2)
  ctx.fillStyle = '#c9b680'
  ctx.fillRect(-EXTENT / 2, -EXTENT / 2, EXTENT, EXTENT)
  const city2 = GRID * CELL + ROAD
  ctx.fillStyle = '#2e2f33'
  ctx.fillRect(-city2 / 2, -city2 / 2, city2, city2)
  ctx.fillStyle = '#7d7f73'
  city.blocks.forEach((b) => ctx.fillRect(b.x - b.w / 2, b.z - b.d / 2, b.w, b.d))
  ctx.fillStyle = '#5f8a3c'
  city.parks.forEach((p) => ctx.fillRect(p.x - p.w / 2, p.z - p.d / 2, p.w, p.d))
  ctx.fillStyle = '#a5a79c'
  city.buildings.forEach((b) => ctx.fillRect(b.x - b.w / 2, b.z - b.d / 2, b.w, b.d))
  return canvas
}

export default function Radar() {
  const ref = useRef()

  useEffect(() => {
    const map = drawMap()
    const ctx = ref.current.getContext('2d')
    let frame

    const draw = () => {
      frame = requestAnimationFrame(draw)
      const { focus, cameraYaw, heading, car } = world
      ctx.save()
      ctx.beginPath()
      ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 3, 0, Math.PI * 2)
      ctx.clip()
      ctx.fillStyle = OCEAN
      ctx.fillRect(0, 0, SIZE, SIZE)

      // Rotate so "up" on the radar is the direction the camera faces.
      ctx.translate(SIZE / 2, SIZE / 2)
      ctx.rotate(-Math.PI / 2 - Math.atan2(-Math.cos(cameraYaw), -Math.sin(cameraYaw)))
      ctx.save()
      ctx.scale(SCALE, SCALE)
      ctx.translate(-focus.x, -focus.z)
      ctx.drawImage(map, -EXTENT / 2, -EXTENT / 2, EXTENT, EXTENT)
      if (car && world.player?.isEnabled()) {
        const c = car.translation()
        ctx.fillStyle = '#4fa3ff'
        ctx.fillRect(c.x - 3, c.z - 3, 6, 6)
      }
      ctx.restore()

      // Player arrow.
      ctx.rotate(Math.atan2(Math.cos(heading), Math.sin(heading)))
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
