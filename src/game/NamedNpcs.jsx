import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import { CanvasTexture, SRGBColorSpace } from 'three'
import Person from './Person'
import { Blob } from './Shadows'
import { NPCS, currentTarget } from './quests'
import { computePose, lookFromSeed } from './people'
import { unlit } from './materials'
import { useGame } from './state'

function nameTagTexture(name) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#0b6b33'
  ctx.beginPath()
  ctx.roundRect(4, 8, 248, 48, 14)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 28px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(name.toUpperCase(), 128, 33)
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  return tex
}

const markerMaterial = unlit({ color: '#ffd23a' })

// Floating, spinning marker over whoever you need to talk to next.
function Marker({ y = 2.6 }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    ref.current.position.y = y + Math.sin(clock.elapsedTime * 2.5) * 0.15
    ref.current.rotation.y = clock.elapsedTime * 1.8
  })
  return (
    <mesh ref={ref} material={markerMaterial} rotation-x={Math.PI}>
      <coneGeometry args={[0.3, 0.55, 4]} />
    </mesh>
  )
}

function Npc({ id, n, active }) {
  const person = useRef()
  const look = useMemo(() => lookFromSeed(id.length * 31, n.look), [id, n.look])
  const tag = useMemo(() => nameTagTexture(n.name), [n.name])
  const state = useMemo(() => ({ pose: {}, input: { phase: 0, t: Math.random() * 10, moving: false, run: false, punch: -1, flinch: 0 } }), [])
  useFrame((_, dt) => {
    const s = state.input
    s.t += dt
    s.flinch = Math.max(0, s.flinch - dt / 0.4)
    if (n.flinchAt && performance.now() - n.flinchAt < 50) s.flinch = 1
    person.current?.animate(computePose(state.pose, s))
  })
  return (
    <group position={[n.pos[0], n.y, n.pos[1]]}>
      <Person ref={person} look={look} rotation-y={n.yaw} />
      <Blob position-y={0.02} scale={[0.9, 1, 0.9]} />
      <Billboard position-y={2.45 * look.height}>
        <mesh>
          <planeGeometry args={[1.6, 0.4]} />
          <meshBasicMaterial map={tag} transparent toneMapped={false} />
        </mesh>
      </Billboard>
      {active && <Marker y={2.95 * look.height} />}
    </group>
  )
}

// Tall glowing column marking a place to drive to.
function Checkpoint({ x, z }) {
  const ref = useRef()
  useFrame(({ clock }) => (ref.current.material.opacity = 0.35 + Math.sin(clock.elapsedTime * 3) * 0.12))
  return (
    <mesh ref={ref} position={[x, 3, z]}>
      <cylinderGeometry args={[3.5, 3.5, 6, 20, 1, true]} />
      <meshBasicMaterial color="#ffd23a" transparent depthWrite={false} toneMapped={false} side={2} />
    </mesh>
  )
}

export default function NamedNpcs() {
  const quest = useGame((s) => s.quest)
  const step = useGame((s) => s.step)
  const target = currentTarget(quest, step)
  return (
    <group>
      {Object.entries(NPCS).map(([id, n]) => (
        <Npc key={id} id={id} n={n} active={target?.npc === id} />
      ))}
      {target?.goto && <Checkpoint x={target.x} z={target.z} />}
    </group>
  )
}
