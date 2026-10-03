import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, NearestFilter, SRGBColorSpace } from 'three'
import { city, ROAD } from './cityData'
import { raceMarkers, RACES } from './racing'
import { toon } from './materials'

// Start arches for the races, with a chequered banner, and the glowing
// checkpoints while you race.

function checkered() {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 32
  const ctx = canvas.getContext('2d')
  for (let x = 0; x < 16; x++) {
    for (let y = 0; y < 4; y++) {
      ctx.fillStyle = (x + y) % 2 ? '#111111' : '#ffffff'
      ctx.fillRect(x * 8, y * 8, 8, 8)
    }
  }
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.magFilter = NearestFilter
  return tex
}

// A name board by each start, from the city's sign system.
const signed = new Set()
for (const race of Object.values(RACES)) {
  if (signed.has(race.id)) continue
  signed.add(race.id)
  const { x, z } = race.start
  city.signs.push({ text: `🏁 ${race.name.toUpperCase()}\nPRESS E TO RACE`, x: x - 4, y: 2.6, z: race.vehicle ? z + ROAD / 2 + 1.5 : z + 4.5, rot: Math.PI, w: 4.4, h: 1.5, bg: '#111111', fg: '#ffd23a', posts: true })
}

const postMaterial = toon({ color: '#e04848' })

function Arch({ race, banner }) {
  const { x, z, yaw } = race.start
  const span = race.vehicle ? ROAD + 2 : 7
  return (
    // The arch stands across the way you race (yaw is the direction of travel).
    <group position={[x, 0, z - (race.vehicle ? 3 : 0)]} rotation-y={yaw}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * span) / 2, 3, 0]} material={postMaterial}>
          <boxGeometry args={[0.35, 6, 0.35]} />
        </mesh>
      ))}
      <mesh position-y={5.6}>
        <boxGeometry args={[span, 0.9, 0.15]} />
        <meshBasicMaterial map={banner} toneMapped={false} />
      </mesh>
    </group>
  )
}

export default function Races() {
  const banner = useMemo(checkered, [])
  return (
    <group>
      {Object.values(RACES).map((race) => (
        <Arch key={race.id} race={race} banner={banner} />
      ))}
      <RaceCheckpoints />
    </group>
  )
}

// The checkpoint columns, following races.js every frame.
function RaceCheckpoints() {
  const a = useRef()
  const b = useRef()
  useFrame(({ clock }) => {
    const m = raceMarkers()
    for (const [ref, point, faint] of [
      [a, m?.current, false],
      [b, m?.next, true],
    ]) {
      const mesh = ref.current
      if (!mesh) continue
      mesh.visible = !!point
      if (!point) continue
      const r = m.vehicle ? 6 : 3
      mesh.position.set(point.x, 3, point.z)
      mesh.scale.set(r, 1, r)
      mesh.material.opacity = (faint ? 0.12 : 0.4) + Math.sin(clock.elapsedTime * 4) * 0.1
    }
  })
  return (
    <>
      {[a, b].map((ref, i) => (
        <mesh key={i} ref={ref} visible={false}>
          <cylinderGeometry args={[1, 1, 6, 20, 1, true]} />
          <meshBasicMaterial color={i ? '#d6f0ff' : '#4fb3ff'} transparent depthWrite={false} toneMapped={false} side={2} />
        </mesh>
      ))}
    </>
  )
}
