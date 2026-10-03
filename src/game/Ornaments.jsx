import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, SRGBColorSpace } from 'three'
import { toonRamp } from './materials'

// Decorations that need more than a box: a fish tank with clear water and
// fish that swim about, and a painting with an actual picture on it.
// Each takes a prop's centre and size (rooms.js format) and its options.

const FISH = [
  ['#ff7a2f', 0.0, 0.0],
  ['#ffd23a', 1.7, 0.18],
  ['#3d8bfd', 3.1, -0.12],
  ['#ff2fb4', 4.4, 0.08],
  ['#f2f2f2', 5.6, -0.2],
]

export function FishTank({ p }) {
  const [x, y, z, w, h, d] = p
  const fish = useRef([])
  const bubbles = useRef([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    fish.current.forEach((f, i) => {
      if (!f) return
      const [, phase, dy] = FISH[i]
      // Lazy laps from end to end, turning round at the glass.
      const s = Math.sin(t * (0.35 + i * 0.07) + phase)
      f.position.set(s * (w / 2 - 0.18), dy + Math.sin(t * 1.3 + i) * 0.05, Math.sin(t * 0.5 + phase * 2) * (d / 2 - 0.12))
      f.rotation.y = Math.cos(t * (0.35 + i * 0.07) + phase) > 0 ? 0 : Math.PI
      f.children[1].rotation.y = Math.sin(t * 9 + i) * 0.5 // tail
    })
    bubbles.current.forEach((b, i) => {
      if (!b) return
      const k = (t * 0.4 + i * 0.27) % 1
      b.position.set(w / 2 - 0.2 - (i % 2) * 0.08, -h / 2 + 0.1 + k * (h - 0.15), -d / 4 + i * 0.05)
      b.scale.setScalar(0.5 + k * 0.6)
    })
  })
  return (
    <group position={[x, y, z]}>
      {/* Glass: barely tinted and see-through, with a dark rim */}
      <mesh renderOrder={2}>
        <boxGeometry args={[w, h, d]} />
        <meshBasicMaterial color="#d8f4ff" transparent opacity={0.16} depthWrite={false} />
      </mesh>
      {[
        [0, h / 2, 0, w + 0.04, 0.04, d + 0.04],
        [0, -h / 2, 0, w + 0.04, 0.04, d + 0.04],
      ].map(([px, py, pz, sw, sh, sd], i) => (
        <mesh key={i} position={[px, py, pz]}>
          <boxGeometry args={[sw, sh, sd]} />
          <meshToonMaterial gradientMap={toonRamp} color="#1d1d22" />
        </mesh>
      ))}
      {/* Clear water just below the rim, sand and weed on the bottom */}
      <mesh position-y={-0.04} renderOrder={1}>
        <boxGeometry args={[w - 0.03, h - 0.1, d - 0.03]} />
        <meshBasicMaterial color="#7fdcff" transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <mesh position-y={-h / 2 + 0.05}>
        <boxGeometry args={[w - 0.04, 0.08, d - 0.04]} />
        <meshToonMaterial gradientMap={toonRamp} color="#e8d29a" />
      </mesh>
      {[-0.55, -0.2, 0.35, 0.6].map((px, i) => (
        <mesh key={i} position={[px * (w / 1.7), -h / 2 + 0.22 + (i % 2) * 0.05, (i % 2 ? 0.1 : -0.12) * d]}>
          <coneGeometry args={[0.05, 0.3 + (i % 2) * 0.12, 5]} />
          <meshToonMaterial gradientMap={toonRamp} color={i % 2 ? '#3f9a4a' : '#2f7a3a'} />
        </mesh>
      ))}
      {FISH.map(([color], i) => (
        <group key={i} ref={(el) => (fish.current[i] = el)}>
          <mesh>
            <sphereGeometry args={[0.055, 8, 6]} />
            <meshBasicMaterial color={color} />
          </mesh>
          <mesh position-x={-0.07}>
            <coneGeometry args={[0.04, 0.06, 4]} />
            <meshBasicMaterial color={color} />
          </mesh>
        </group>
      ))}
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(el) => (bubbles.current[i] = el)}>
          <sphereGeometry args={[0.02, 6, 4]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  )
}

// A Lagos sunset over the lagoon: sky, sun, the Third Mainland Bridge, the
// Marina skyline, a palm and a yellow danfo.
function paintLagos() {
  const W = 512
  const H = 352
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const c = canvas.getContext('2d')
  const sky = c.createLinearGradient(0, 0, 0, H * 0.62)
  sky.addColorStop(0, '#2a3a7a')
  sky.addColorStop(0.5, '#e8607a')
  sky.addColorStop(1, '#ffc46a')
  c.fillStyle = sky
  c.fillRect(0, 0, W, H)
  c.fillStyle = '#ffe9a8'
  c.beginPath()
  c.arc(W * 0.7, H * 0.5, 40, 0, Math.PI * 2)
  c.fill()
  // Skyline
  c.fillStyle = '#3a2a4a'
  let bx = 20
  for (const [bw, bh] of [[40, 90], [30, 140], [50, 110], [26, 170], [44, 120], [36, 80], [30, 150], [48, 100], [34, 130]]) {
    c.fillRect(bx, H * 0.62 - bh, bw, bh)
    c.fillStyle = '#ffd88a'
    for (let wy = H * 0.62 - bh + 10; wy < H * 0.62 - 10; wy += 16) for (let wx = bx + 6; wx < bx + bw - 6; wx += 10) if ((wx + wy) % 3) c.fillRect(wx, wy, 4, 6)
    c.fillStyle = '#3a2a4a'
    bx += bw + 6
  }
  // Lagoon with reflections
  const water = c.createLinearGradient(0, H * 0.62, 0, H)
  water.addColorStop(0, '#d0607a')
  water.addColorStop(1, '#1f3a6a')
  c.fillStyle = water
  c.fillRect(0, H * 0.62, W, H)
  c.fillStyle = 'rgba(255, 233, 168, 0.6)'
  for (let k = 0; k < 7; k++) c.fillRect(W * 0.7 - 40 + k * 3, H * 0.66 + k * 12, 80 - k * 6, 3)
  // The bridge on its piers
  c.fillStyle = '#2a2030'
  c.fillRect(0, H * 0.7, W, 8)
  for (let px = 10; px < W; px += 46) c.fillRect(px, H * 0.7, 6, 40)
  c.fillStyle = '#f2b705'
  c.fillRect(W * 0.32, H * 0.7 - 12, 34, 12) // danfo crossing
  c.fillStyle = '#1d1d22'
  c.fillRect(W * 0.33, H * 0.7 - 10, 30, 4)
  // A palm in front
  c.strokeStyle = '#2a1a14'
  c.lineWidth = 9
  c.beginPath()
  c.moveTo(W * 0.12, H)
  c.quadraticCurveTo(W * 0.16, H * 0.6, W * 0.1, H * 0.35)
  c.stroke()
  c.fillStyle = '#1f3a24'
  for (let k = 0; k < 6; k++) {
    c.save()
    c.translate(W * 0.1, H * 0.35)
    c.rotate((k / 6) * Math.PI * 2)
    c.beginPath()
    c.ellipse(36, 0, 40, 9, 0.3, 0, Math.PI * 2)
    c.fill()
    c.restore()
  }
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  return tex
}

export function Painting({ p }) {
  const [x, y, z, w, h, d] = p
  const picture = useMemo(paintLagos, [])
  // Hung on a side wall: the picture faces into the room (-x or +x).
  const facing = x > 0 ? -1 : 1
  return (
    <group position={[x, y, z]} rotation-y={facing * Math.PI / 2}>
      <mesh>
        <boxGeometry args={[d, h, Math.max(w, 0.04)]} />
        <meshToonMaterial gradientMap={toonRamp} color="#d4af37" />
      </mesh>
      <mesh position-z={0.03}>
        <planeGeometry args={[d - 0.14, h - 0.14]} />
        <meshBasicMaterial map={picture} toneMapped={false} />
      </mesh>
    </group>
  )
}
