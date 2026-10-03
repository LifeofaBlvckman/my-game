import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import { CanvasTexture, SRGBColorSpace } from 'three'
import Person from './Person'
import { Blob } from './Shadows'
import { activeTarget, npcAround, NPCS, SIDE_JOBS } from './quests'
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
const sideMarkerMaterial = unlit({ color: '#4fb3ff' })

// Floating, spinning marker over whoever you need to talk to next (yellow),
// or over someone offering a side job (blue).
function Marker({ y = 2.6, side = false }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    ref.current.position.y = y + Math.sin(clock.elapsedTime * 2.5) * 0.15
    ref.current.rotation.y = clock.elapsedTime * 1.8
  })
  return (
    <mesh ref={ref} material={side ? sideMarkerMaterial : markerMaterial} rotation-x={Math.PI}>
      <coneGeometry args={[0.3, 0.55, 4]} />
    </mesh>
  )
}

function Npc({ id, n, active, offering }) {
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
      <Billboard position-y={2.25 * look.height}>
        <mesh>
          <planeGeometry args={[1.6, 0.4]} />
          <meshBasicMaterial map={tag} transparent toneMapped={false} />
        </mesh>
      </Billboard>
      {active && <Marker y={2.7 * look.height} />}
      {!active && offering && <Marker y={2.7 * look.height} side />}
    </group>
  )
}

// Tall glowing column marking a place to drive to. `faint`: the one after next.
function Checkpoint({ x, z, faint = false, radius = 3.5 }) {
  const ref = useRef()
  useFrame(({ clock }) => (ref.current.material.opacity = (faint ? 0.12 : 0.35) + Math.sin(clock.elapsedTime * 3) * 0.1))
  return (
    <mesh ref={ref} position={[x, 3, z]}>
      <cylinderGeometry args={[radius, radius, 6, 20, 1, true]} />
      <meshBasicMaterial color={faint ? '#fff2b0' : '#ffd23a'} transparent depthWrite={false} toneMapped={false} side={2} />
    </mesh>
  )
}

// Something to pick up: a plastic bottle, spinning and bobbing on the sand.
function Pickup({ x, z }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    ref.current.rotation.y = t * 2
    ref.current.position.y = 0.5 + Math.sin(t * 3 + x) * 0.12
  })
  return (
    <group position={[x, 0, z]}>
      <group ref={ref} rotation-z={0.5}>
        <mesh>
          <cylinderGeometry args={[0.12, 0.12, 0.42, 8]} />
          <meshBasicMaterial color="#9fe3ff" toneMapped={false} />
        </mesh>
        <mesh position-y={0.27}>
          <cylinderGeometry args={[0.05, 0.05, 0.12, 6]} />
          <meshBasicMaterial color="#3a7bd5" toneMapped={false} />
        </mesh>
      </group>
      <mesh position-y={1.4}>
        <coneGeometry args={[0.18, 0.32, 4]} />
        <meshBasicMaterial color="#ffd23a" toneMapped={false} />
      </mesh>
    </group>
  )
}

export default function NamedNpcs() {
  useGame((s) => s.quest)
  useGame((s) => s.step)
  useGame((s) => s.jobProgress)
  const sideJob = useGame((s) => s.sideJob)
  const target = activeTarget(useGame.getState())
  const offering = new Set(sideJob ? [] : SIDE_JOBS.map((j) => j.giver))
  return (
    <group>
      {Object.entries(NPCS)
        .filter(([, n]) => npcAround(n, useGame.getState()))
        .map(([id, n]) => (
          <Npc key={id} id={id} n={n} active={target?.npc === id} offering={offering.has(id)} />
        ))}
      {target?.goto && <Checkpoint x={target.x} z={target.z} />}
      {target?.checkpoints && <Checkpoint key={`c${target.done}`} x={target.x} z={target.z} radius={target.vehicle ? 6 : 3.5} />}
      {target?.checkpoints && target.next && <Checkpoint key={`n${target.done}`} x={target.next.x} z={target.next.z} radius={target.vehicle ? 6 : 3.5} faint />}
      {target?.collect && target.items.map((it, k) => !useGame.getState().collected.includes(k) && <Pickup key={k} x={it.x} z={it.z} />)}
    </group>
  )
}
