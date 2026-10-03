import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { BoxGeometry, Color, CylinderGeometry, SphereGeometry } from 'three'
import Person from './Person'
import { Instances } from './Instances'
import { computePose, lookFromSeed } from './people'
import { INTERIORS } from './rooms'
import { toonRamp, unlit } from './materials'
import { useGame } from './state'
import { homeColors, homeProps } from './decor'

const geometries = { box: new BoxGeometry(1, 1, 1), sphere: new SphereGeometry(0.5, 12, 8), cylinder: new CylinderGeometry(0.5, 0.5, 1, 14) }
const DANCE_COLORS = ['#ff2fb4', '#39e6ff', '#ffd23a', '#7a4dff', '#3fe07a'].map((c) => new Color(c))
const WALL = 0.3

function Prop({ p }) {
  const [x, y, z, w, h, d, color, opts = {}] = p
  const geometry = geometries[opts.shape ?? 'box']
  // Cylinders stand upright, unless much wider than deep (a vault door): then they face forward.
  const flat = opts.shape === 'cylinder' && w > d * 2
  return (
    <mesh geometry={geometry} position={[x, y, z]} scale={flat ? [w, d, h] : [w, h, d]} rotation-x={flat ? Math.PI / 2 : 0}>
      {opts.glow ? <meshBasicMaterial color={color} toneMapped={false} /> : <meshToonMaterial gradientMap={toonRamp} color={color} />}
    </mesh>
  )
}

// One person in a room, with an activity: dancing, DJing, sitting, lifting,
// running on a treadmill, or just standing around.
function RoomPerson({ npc, index }) {
  const person = useRef()
  const look = useMemo(() => lookFromSeed(npc.seed ?? 900 + index, { ...npc.look }), [npc, index])
  const state = useMemo(() => ({ pose: {}, input: { phase: index, t: index * 1.7, moving: false, run: false, punch: -1, flinch: 0 } }), [index])
  useFrame((_, dt) => {
    const s = state.input
    s.t += dt
    const t = s.t
    s.moving = npc.anim === 'run'
    s.run = npc.anim === 'run'
    if (s.moving) s.phase += dt * 11
    const p = computePose(state.pose, s)
    if (npc.anim === 'dance') {
      const beat = t * Math.PI * 2 * (104 / 60 / 2)
      p.bob = Math.abs(Math.sin(beat)) * 0.12
      p.armL = -2.2 - Math.sin(beat) * 0.6
      p.armR = -1.2 + Math.sin(beat) * 0.9
      p.legL = Math.sin(beat) * 0.25 - 0.1
      p.legR = -Math.sin(beat) * 0.25 - 0.1
      p.shinL = p.shinR = 0.2 + Math.abs(Math.sin(beat)) * 0.3
      p.foreL = -0.6
      p.foreR = -1.2
      p.twist = Math.sin(beat * 0.5) * 0.4
      p.headNod = Math.sin(beat * 2) * 0.12
    } else if (npc.anim === 'dj') {
      const beat = t * Math.PI * 2 * (104 / 60)
      p.armL = p.armR = -0.9
      p.foreL = p.foreR = -0.6
      p.lean = 0.25
      p.headNod = Math.sin(beat) * 0.18
      p.bob = Math.abs(Math.sin(beat)) * 0.04
    } else if (npc.anim === 'sit') {
      p.bob = -0.42
      p.legL = p.legR = -1.5
      p.shinL = p.shinR = 1.5
      p.armL = p.armR = -0.45
      p.foreL = p.foreR = -0.6
      p.lean = 0
    } else if (npc.anim === 'lift') {
      const k = (Math.sin(t * 1.8) + 1) / 2
      p.armL = p.armR = -0.3 - k * 2.6
      p.foreL = p.foreR = -0.2
      p.sy = 1 - k * 0.02
    }
    person.current?.animate(p)
  })
  return <Person ref={person} look={look} position={[npc.pos[0], npc.y ?? 0, npc.pos[1]]} rotation-y={npc.yaw} />
}

// Flashing club floor tiles.
function DanceFloor({ spec }) {
  const tiles = useMemo(() => {
    const list = []
    for (let c = 0; c < spec.cols; c++) for (let r = 0; r < spec.rows; r++) list.push({ c, r })
    return list
  }, [spec])
  const mesh = useRef()
  const material = useMemo(() => unlit(), [])
  useFrame(({ clock }) => {
    const beat = Math.floor(clock.elapsedTime * (104 / 60))
    tiles.forEach((t, i) => mesh.current.setColorAt(i, DANCE_COLORS[(t.c * 3 + t.r * 7 + beat) % DANCE_COLORS.length]))
    mesh.current.instanceColor.needsUpdate = true
  })
  return (
    <Instances
      ref={mesh}
      items={tiles}
      material={material}
      castShadow={false}
      transform={(o, t) => {
        o.position.set(spec.x + (t.c - (spec.cols - 1) / 2) * spec.tile, 0.01, spec.z + (t.r - (spec.rows - 1) / 2) * spec.tile)
        o.scale.set(spec.tile - 0.08, 0.02, spec.tile - 0.08)
      }}
      colors={() => '#ffffff'}
    />
  )
}

function Room({ room }) {
  const [W, H, D] = room.size
  // Tunde's room is decorated the way the player chose.
  const decor = useGame((s) => (room.id === 'home' ? s.decor : null))
  const props = useMemo(() => (decor ? homeProps(decor) : room.props), [decor, room])
  const { wall, floor } = decor ? homeColors(decor) : room
  const walls = [
    [0, H / 2, -D / 2, W, H, WALL],
    [-W / 2, H / 2, 0, WALL, H, D],
    [W / 2, H / 2, 0, WALL, H, D],
    [-(W / 4 + 0.75), H / 2, D / 2, W / 2 - 1.5, H, WALL],
    [W / 4 + 0.75, H / 2, D / 2, W / 2 - 1.5, H, WALL],
    [0, H - 0.6, D / 2, 3, 1.2, WALL],
  ]
  return (
    <group position={room.origin}>
      <mesh position={[0, -0.25, 0]} scale={[W, 0.5, D]} geometry={geometries.box}>
        <meshToonMaterial gradientMap={toonRamp} color={floor} />
      </mesh>
      <mesh position={[0, H + 0.25, 0]} scale={[W, 0.5, D]} geometry={geometries.box}>
        <meshToonMaterial gradientMap={toonRamp} color={wall} />
      </mesh>
      {walls.map(([x, y, z, w, h, d], i) => (
        <mesh key={i} position={[x, y, z]} scale={[w, h, d]} geometry={geometries.box}>
          <meshToonMaterial gradientMap={toonRamp} color={wall} />
        </mesh>
      ))}
      {/* The way out: a glowing doorway in the middle of the front wall */}
      <mesh position={[0, 1.2, D / 2 + 0.2]} scale={[3, 2.4, 0.1]} geometry={geometries.box}>
        <meshBasicMaterial color="#fff1c8" toneMapped={false} />
      </mesh>
      {props.map((p, i) => (
        <Prop key={`${i}${p[6]}`} p={p} />
      ))}
      {room.danceFloor && <DanceFloor spec={room.danceFloor} />}
      {room.npcs.map((n, i) => (
        <RoomPerson key={i} npc={n} index={i} />
      ))}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[W / 2, 0.25, D / 2]} position={[0, -0.25, 0]} />
        <CuboidCollider args={[W / 2, 0.25, D / 2]} position={[0, H + 0.25, 0]} />
        {walls.map(([x, y, z, w, h, d], i) => (
          <CuboidCollider key={i} args={[w / 2, h / 2, d / 2]} position={[x, y, z]} />
        ))}
        {/* The doorway itself is solid: you leave with E, not by walking through. */}
        <CuboidCollider args={[1.5, H / 2, WALL / 2]} position={[0, H / 2, D / 2 + 0.3]} />
        {props
          .filter((p) => p[7]?.solid)
          .map(([x, y, z, w, h, d], i) => (
            <CuboidCollider key={`p${i}:${x},${z}`} args={[w / 2, h / 2, d / 2]} position={[x, y, z]} />
          ))}
      </RigidBody>
    </group>
  )
}

// Interior lights are always in the scene (just dark while you're outside),
// so walking through a door doesn't make every material recompile.
function RoomLights({ room }) {
  const a = useRef()
  const b = useRef()
  const base = useMemo(() => new Color(), [])
  useFrame(({ clock }) => {
    if (!room) {
      a.current.intensity = b.current.intensity = 0
      return
    }
    const [W, H] = room.size
    const o = room.origin
    const t = clock.elapsedTime
    base.set(room.light)
    a.current.color.copy(base)
    a.current.position.set(o[0], o[1] + H - 0.6, o[2])
    a.current.intensity = room.danceFloor ? 4 : 6
    a.current.distance = Math.max(W, room.size[2]) * 1.2
    // Clubs get a second, roaming colored light.
    if (room.danceFloor) {
      b.current.color.copy(DANCE_COLORS[Math.floor(t * 1.7) % DANCE_COLORS.length])
      b.current.position.set(o[0] + Math.sin(t) * W * 0.3, o[1] + H - 1, o[2] + Math.cos(t * 0.7) * 3)
      b.current.intensity = 10
    } else {
      b.current.color.copy(base)
      b.current.position.set(o[0], o[1] + H - 0.6, o[2] - room.size[2] * 0.3)
      b.current.intensity = 3
    }
    b.current.distance = W
  })
  return (
    <>
      <pointLight ref={a} intensity={0} decay={1.4} />
      <pointLight ref={b} intensity={0} decay={1.4} />
    </>
  )
}

export default function Interiors() {
  const inside = useGame((s) => s.inside)
  const room = inside ? INTERIORS[inside] : null
  return (
    <>
      <RoomLights room={room} />
      {room && <Room key={room.id} room={room} />}
    </>
  )
}
