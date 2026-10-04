import { useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import { CapsuleCollider, CuboidCollider, RigidBody } from '@react-three/rapier'
import { CanvasTexture, PlaneGeometry, Quaternion, SRGBColorSpace, Vector3 } from 'three'
import Person from './Person'
import { Body, Wheel } from './Car'
import { Blob } from './Shadows'
import EmoteBubble from './EmoteBubble'
import { computePose, lookFromSeed } from './people'
import { hasPattern, lookFromOutfit } from './wardrobe'
import { makeAnkaraTexture } from './faces'
import { FLAGS } from './net'
import { fx } from './particles'
import { VEHICLES } from './vehicleTypes'
import { useGame, world } from './state'
import { toonRamp } from './materials'
import RemoteChase, { CHASE_LIMITS } from './RemoteChase'
import { vehicles } from './trafficSim'
import { npcs } from './crowd'

const hashName = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)
const q = new Quaternion()
// The name sits at the middle; the stars hang below it.
const tagPlane = new PlaneGeometry(1.6, 0.8).translate(0, -0.2, 0)
const up = new Vector3(0, 1, 0)

// Their name, with their wanted stars under it while the police are after them.
function nameTag(name, wanted = 0) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = wanted > 0 ? '#b8322f' : '#2f5fb8'
  ctx.beginPath()
  ctx.roundRect(4, 8, 248, 48, 14)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 28px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(name, 128, 33)
  if (wanted > 0) {
    ctx.font = 'bold 34px Arial, sans-serif'
    ctx.lineWidth = 6
    ctx.strokeStyle = '#1b1b24'
    const stars = '★'.repeat(wanted) + '☆'.repeat(5 - wanted)
    ctx.strokeText(stars, 128, 88)
    ctx.fillStyle = '#ffd23a'
    ctx.fillText(stars, 128, 88)
  }
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  return tex
}

function RemotePlayer({ id }) {
  const r = world.net?.remotes.get(id)
  const body = useRef()
  const visual = useRef()
  const person = useRef()
  const anim = useRef({ phase: 0, t: 0, pose: {}, input: {}, hitCooldown: 0 })
  const [shape, setShape] = useState({ m: r?.s?.m ?? 'f', c: r?.s?.c ?? 'sedan', k: r?.s?.k ?? '#c9ccd1' })
  const [wanted, setWanted] = useState(0)
  // What they chose in their wardrobe, or (an older game) a look from their name.
  const outfit = useGame((st) => st.remoteLooks[id])
  const look = useMemo(() => {
    // Their own face and skin (a girl's face for a girl), their own clothes.
    const h = hashName(r?.name ?? 'player')
    const seeded = lookFromSeed(h, { robe: false, female: false })
    if (!outfit) return seeded
    return lookFromOutfit(outfit, { face: (outfit.g === 'girl' ? 8 : 0) + (h % 8), skin: seeded.skin }, outfit.g)
  }, [outfit, r?.name])
  const shirt = useMemo(makeAnkaraTexture, [])
  const tag = useMemo(() => nameTag(r?.name ?? 'Player', wanted), [r?.name, wanted])
  const tagMesh = useRef()
  const camera = useThree((st) => st.camera)

  useFrame((_, rawDt) => {
    const net = world.net
    const remote = net?.remotes.get(id)
    if (!remote || !body.current) return
    net.sample(remote)
    remote.body = body.current
    const s = remote.s
    if (!s) return
    // The name tag grows with distance so friends can spot each other from
    // far away (it shows through buildings too).
    if (tagMesh.current) {
      const d = camera.position.distanceTo(body.current.translation())
      tagMesh.current.scale.setScalar(Math.min(8, Math.max(1, d / 14)))
    }
    if (s.m !== shape.m || s.c !== shape.c || s.k !== shape.k) setShape({ m: s.m, c: s.c, k: s.k })
    if ((s.w ?? 0) !== wanted) setWanted(s.w ?? 0)

    q.setFromAxisAngle(up, remote.yaw)
    // A big jump (they just appeared, went through a door, or respawned) is a
    // teleport. Moving a kinematic body that far in one step would count as
    // thousands of m/s and fling anyone standing nearby across the map.
    const at = body.current.translation()
    const rotation = s.m === 'c' ? q : { x: 0, y: 0, z: 0, w: 1 }
    if (Math.hypot(remote.x - at.x, remote.y - at.y, remote.z - at.z) > 3) {
      body.current.setTranslation({ x: remote.x, y: remote.y, z: remote.z }, true)
      body.current.setRotation(rotation, true)
    } else {
      body.current.setNextKinematicTranslation({ x: remote.x, y: remote.y, z: remote.z })
      body.current.setNextKinematicRotation(rotation)
    }

    const dt = Math.min(rawDt, 0.1)
    const a = anim.current
    if (s.m === 'f' && visual.current) {
      const moving = (s.a & FLAGS.moving) !== 0
      a.t += dt
      const sprint = (s.a & FLAGS.run) !== 0
      a.phase += dt * (moving ? (sprint ? 16.6 : 11.4) : 0)
      Object.assign(a.input, { phase: a.phase, t: a.t, moving, run: true, sprint, punch: s.u ?? -1, punchSide: 1, flinch: 0 })
      person.current?.animate(computePose(a.pose, a.input))
      visual.current.rotation.set((s.a & FLAGS.down) !== 0 ? -Math.PI / 2 : 0, remote.yaw, 0, 'YXZ')
    }

    // Running over another player.
    const game = useGame.getState()
    a.hitCooldown -= dt
    if (s.m === 'f' && game.mode === 'car' && Math.abs(world.carSpeed) > 6 && a.hitCooldown <= 0 && world.car) {
      const c = world.car.translation()
      const half = VEHICLES[game.carType].half
      const rx = remote.x - c.x
      const rz = remote.z - c.z
      const cos = Math.cos(world.carHeading)
      const sin = Math.sin(world.carHeading)
      if (Math.abs(rx * cos - rz * sin) < half[0] + 0.4 && Math.abs(rx * sin + rz * cos) < half[2] + 0.4) {
        net.hit(id, Math.abs(world.carSpeed) * 2)
        fx.pow(remote.x, remote.y + 1, remote.z, 'BAM!')
        a.hitCooldown = 1
      }
    }
  })

  if (!r) return null
  const def = VEHICLES[shape.c] ?? VEHICLES.sedan
  return (
    <>
      {wanted > 0 && <RemoteChase id={id} />}
      <RigidBody ref={body} key={`${shape.m}${shape.c}`} type="kinematicPosition" colliders={false} position={[r.x, r.y, r.z]}>
        {shape.m === 'c' ? (
          <>
            <CuboidCollider args={def.half} />
            <Body type={shape.c} color={shape.k} driver={look} />
            {def.wheels.at.map((w, i) => (
        <Wheel key={i} r={def.wheels.r} position={w} />
      ))}
            <Blob position-y={-def.half[1] + 0.03} scale={[def.half[0] * 2.6, 1, def.half[2] * 2.4]} />
          </>
        ) : (
          <>
            {/* Not solid: friends walking into each other (or arriving on the
                same spot) would shove one another through walls. */}
            <CapsuleCollider args={[0.55, 0.35]} sensor />
            <group ref={visual} position-y={-0.9}>
              <Person ref={person} look={look} shirtMap={outfit && hasPattern(outfit) ? shirt : null} />
            </group>
            <Blob position-y={-0.88} scale={[0.9, 1, 0.9]} />
          </>
        )}
        <EmoteBubble get={() => world.net?.remotes.get(id)?.emote} y={shape.m === 'c' ? def.half[1] + 2.2 : 2.2} />
        <Billboard position-y={shape.m === 'c' ? def.half[1] + 1.4 : 1.45}>
          <mesh ref={tagMesh} renderOrder={20} geometry={tagPlane}>
            <meshBasicMaterial map={tag} transparent toneMapped={false} depthTest={false} />
          </mesh>
        </Billboard>
      </RigidBody>
    </>
  )
}

// Our own police chase, for everyone else to see: the nearest chasing cars
// and officers on foot, as [x, z, heading] (officers also send their height).
const round = (v) => Math.round(v * 10) / 10
function ourChase(game, at) {
  if (game.wanted <= 0 || game.inside) return { pc: [], pf: [] }
  const near = (o) => Math.hypot(o.x - at.x, o.z - at.z)
  const pc = vehicles
    .filter((v) => v.chasing && !v.wrecked && near(v) < 150)
    .sort((a, b) => near(a) - near(b))
    .slice(0, CHASE_LIMITS.CARS)
    .map((v) => [round(v.x + (v.offX ?? 0)), round(v.z + (v.offZ ?? 0)), round(v.yaw)])
  const pf = npcs
    .filter((n) => n.kind === 'cop' && n.active && near(n) < 80)
    .sort((a, b) => near(a) - near(b))
    .slice(0, CHASE_LIMITS.OFFICERS)
    .map((n) => [round(n.x), round(n.z), round(n.yaw ?? 0), round(n.y ?? 0)])
  return { pc, pf }
}

// Draws everyone else who's online and sends our own position to them.
export default function RemotePlayers() {
  const ids = useGame((s) => s.remotes)

  useFrame(() => {
    const net = world.net
    if (!net || net.id === null || !world.player) return
    const game = useGame.getState()
    const inCar = game.mode === 'car'
    const p = inCar ? world.car.translation() : world.player.translation()
    const v = inCar ? null : world.player.linvel()
    const footSpeed = v ? Math.hypot(v.x, v.z) : 0
    let a = 0
    if (inCar ? Math.abs(world.carSpeed) > 0.5 : footSpeed > 0.5) a |= FLAGS.moving
    if (footSpeed > 8) a |= FLAGS.run // sprinting
    if (world.playerDown > 0) a |= FLAGS.down
    net.sendState({
      p: [p.x, p.y, p.z],
      y: inCar ? world.carHeading : world.heading,
      m: inCar ? 'c' : 'f',
      c: game.carType,
      k: game.carColor,
      a,
      u: world.punch ? world.punch.t : -1,
      w: game.wanted,
      ...ourChase(game, p),
    })
  })

  return ids.map((id) => <RemotePlayer key={id} id={id} />)
}
