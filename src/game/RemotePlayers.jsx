import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import { CapsuleCollider, CuboidCollider, RigidBody } from '@react-three/rapier'
import { CanvasTexture, Quaternion, SRGBColorSpace, Vector3 } from 'three'
import Person from './Person'
import { Body } from './Car'
import { Blob } from './Shadows'
import { computePose, lookFromSeed } from './people'
import { FLAGS } from './net'
import { fx } from './particles'
import { VEHICLES } from './vehicleTypes'
import { useGame, world } from './state'
import { toonRamp } from './materials'

const hashName = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)
const q = new Quaternion()
const up = new Vector3(0, 1, 0)

function nameTag(name) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#2f5fb8'
  ctx.beginPath()
  ctx.roundRect(4, 8, 248, 48, 14)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 28px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(name, 128, 33)
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
  const look = useMemo(() => lookFromSeed(hashName(r?.name ?? 'player'), { robe: false }), [r?.name])
  const tag = useMemo(() => nameTag(r?.name ?? 'Player'), [r?.name])

  useFrame((_, rawDt) => {
    const net = world.net
    const remote = net?.remotes.get(id)
    if (!remote || !body.current) return
    net.sample(remote)
    const s = remote.s
    if (!s) return
    if (s.m !== shape.m || s.c !== shape.c || s.k !== shape.k) setShape({ m: s.m, c: s.c, k: s.k })

    q.setFromAxisAngle(up, remote.yaw)
    body.current.setNextKinematicTranslation({ x: remote.x, y: remote.y, z: remote.z })
    body.current.setNextKinematicRotation(s.m === 'c' ? q : { x: 0, y: 0, z: 0, w: 1 })

    const dt = Math.min(rawDt, 0.1)
    const a = anim.current
    if (s.m === 'f' && visual.current) {
      const moving = (s.a & FLAGS.moving) !== 0
      a.t += dt
      a.phase += dt * (moving ? ((s.a & FLAGS.run) !== 0 ? 16 : 8) : 0)
      Object.assign(a.input, { phase: a.phase, t: a.t, moving, run: (s.a & FLAGS.run) !== 0, punch: s.u ?? -1, punchSide: 1, flinch: 0 })
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
    <RigidBody ref={body} key={`${shape.m}${shape.c}`} type="kinematicPosition" colliders={false} position={[r.x, r.y, r.z]}>
      {shape.m === 'c' ? (
        <>
          <CuboidCollider args={def.half} />
          <Body type={shape.c} color={shape.k} driver={look} />
          {def.wheels.at.map((w, i) => (
            <mesh key={i} position={w} rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[def.wheels.r, def.wheels.r, 0.28, 10]} />
              <meshToonMaterial gradientMap={toonRamp} color="#1a1a1a" />
            </mesh>
          ))}
          <Blob position-y={-def.half[1] + 0.03} scale={[def.half[0] * 2.6, 1, def.half[2] * 2.4]} />
        </>
      ) : (
        <>
          <CapsuleCollider args={[0.55, 0.35]} />
          <group ref={visual} position-y={-0.9}>
            <Person ref={person} look={look} />
          </group>
          <Blob position-y={-0.88} scale={[0.9, 1, 0.9]} />
        </>
      )}
      <Billboard position-y={shape.m === 'c' ? def.half[1] + 1.4 : 1.45}>
        <mesh>
          <planeGeometry args={[1.6, 0.4]} />
          <meshBasicMaterial map={tag} transparent toneMapped={false} depthTest={false} />
        </mesh>
      </Billboard>
    </RigidBody>
  )
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
    if (footSpeed > 6) a |= FLAGS.run
    if (world.playerDown > 0) a |= FLAGS.down
    net.sendState({
      p: [p.x, p.y, p.z],
      y: inCar ? world.carHeading : world.heading,
      m: inCar ? 'c' : 'f',
      c: game.carType,
      k: game.carColor,
      a,
      u: world.punch ? world.punch.t : -1,
    })
  })

  return ids.map((id) => <RemotePlayer key={id} id={id} />)
}
