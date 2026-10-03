import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import Person from './Person'
import { Body } from './Car'
import { Blob } from './Shadows'
import { computePose, COP_LOOK } from './people'
import { VEHICLES } from './vehicleTypes'
import { toonRamp, unlit } from './materials'
import { world } from './state'

// The police chasing another player. Each player's own game runs its own
// police; it tells everyone else where its chasing cars and officers are, and
// this draws them (with flashing lights) so you can watch a friend's chase.
// They're only pictures: they don't block you or arrest you.

const CARS = 3
const OFFICERS = 3
const def = VEHICLES.police
const red = unlit({ color: '#ff2a2a', fog: true })
const blue = unlit({ color: '#2a6bff', fog: true })
const off = unlit({ color: '#30161a', fog: true })
// The light bar: the police car's own siren boxes, drawn a touch bigger.
const sirenA = def.parts.find((p) => p[6] === 'sirenA')
const sirenB = def.parts.find((p) => p[6] === 'sirenB')
const bar = (p) => ({ position: [p[0], p[1] + 0.01, p[2]], scale: [p[3] + 0.04, p[4] + 0.04, p[5] + 0.04] })

// Chase toward the latest position, or jump there if it's far (a new cop).
function follow(o, target, dt) {
  const d = Math.hypot(target[0] - o.x, target[1] - o.z)
  if (o.x === undefined || d > 10) {
    o.x = target[0]
    o.z = target[1]
    o.yaw = target[2]
  } else {
    const k = Math.min(1, dt * 10)
    o.x += (target[0] - o.x) * k
    o.z += (target[1] - o.z) * k
    o.yaw += Math.atan2(Math.sin(target[2] - o.yaw), Math.cos(target[2] - o.yaw)) * k
  }
  o.speed = d / Math.max(dt, 0.001)
}

function CopCar({ index, get }) {
  const group = useRef()
  const left = useRef()
  const right = useRef()
  const o = useRef({})
  useFrame(({ clock }, rawDt) => {
    const target = get()?.[index]
    const g = group.current
    if (!g) return
    g.visible = !!target
    if (!target) {
      o.current.x = undefined
      return
    }
    follow(o.current, target, Math.min(rawDt, 0.1))
    g.position.set(o.current.x, def.half[1], o.current.z)
    g.rotation.y = o.current.yaw
    const flip = Math.floor(clock.elapsedTime * 6) % 2 === 0
    left.current.material = flip ? red : off
    right.current.material = flip ? off : blue
  })
  return (
    <group ref={group} visible={false}>
      <Body type="police" color={def.colors[0]} driver={COP_LOOK} />
      {def.wheels.at.map((w, i) => (
        <mesh key={i} position={w} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[def.wheels.r, def.wheels.r, 0.28, 10]} />
          <meshToonMaterial gradientMap={toonRamp} color="#1a1a1a" />
        </mesh>
      ))}
      {/* Light bar, bright enough to see from down the road */}
      <mesh ref={left} {...bar(sirenA)} material={red}>
        <boxGeometry />
      </mesh>
      <mesh ref={right} {...bar(sirenB)} material={blue}>
        <boxGeometry />
      </mesh>
      <Blob position-y={-def.half[1] + 0.03} scale={[def.half[0] * 2.6, 1, def.half[2] * 2.4]} />
    </group>
  )
}

function Officer({ index, get }) {
  const group = useRef()
  const person = useRef()
  const o = useRef({})
  const a = useRef({ pose: {}, input: {}, phase: 0, t: 0 })
  useFrame((_, rawDt) => {
    const target = get()?.[index]
    const g = group.current
    if (!g) return
    g.visible = !!target
    if (!target) {
      o.current.x = undefined
      return
    }
    const dt = Math.min(rawDt, 0.1)
    follow(o.current, target, dt)
    g.position.set(o.current.x, target[3] ?? 0.12, o.current.z)
    g.rotation.y = o.current.yaw
    const moving = o.current.speed > 0.8
    a.current.t += dt
    a.current.phase += dt * (moving ? 11.4 : 0)
    Object.assign(a.current.input, { phase: a.current.phase, t: a.current.t, moving, run: true, sprint: false, punch: -1, punchSide: 1, flinch: 0 })
    person.current?.animate(computePose(a.current.pose, a.current.input))
  })
  return (
    <group ref={group} visible={false}>
      <Person ref={person} look={COP_LOOK} />
      <Blob position-y={0.02} scale={[0.9, 1, 0.9]} />
    </group>
  )
}

// `id`: whose chase. Mounted only while that player is wanted.
export default function RemoteChase({ id }) {
  const latest = () => world.net?.remotes.get(id)?.s
  const cars = () => latest()?.pc
  const officers = () => latest()?.pf
  // Their sirens, for our ears: loud when their chase is near us.
  useFrame(() => {
    const list = cars()
    if (!list?.length || !world.focus) return
    let near = Infinity
    for (const c of list) near = Math.min(near, Math.hypot(c[0] - world.focus.x, c[1] - world.focus.z))
    world.remoteSiren = Math.max(world.remoteSiren ?? 0, Math.max(0, 1 - near / 120))
  })
  return (
    <>
      {Array.from({ length: CARS }, (_, i) => (
        <CopCar key={`c${i}`} index={i} get={cars} />
      ))}
      {Array.from({ length: OFFICERS }, (_, i) => (
        <Officer key={`o${i}`} index={i} get={officers} />
      ))}
    </>
  )
}

export const CHASE_LIMITS = { CARS, OFFICERS }
