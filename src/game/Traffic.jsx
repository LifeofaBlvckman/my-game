import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { Color, CylinderGeometry, Matrix4, Quaternion, Vector3 } from 'three'
import { city } from './cityData'
import { initTraffic, updateTraffic, vehicles } from './trafficSim'
import { MAX_PARTS, MAX_WHEELS, partColor, VEHICLES } from './vehicleTypes'
import { carBox } from './shapes'
import { explode, hurtPlayer, TRAFFIC_HP, vehicleSmoke, wreckVehicle } from './damage'
import { honk } from './audio'
import { toonRamp, unlit } from './materials'
import { useGame, world } from './state'
import { blobGeometry, blobMaterial } from './Shadows'

const wheelGeometry = new CylinderGeometry(1, 1, 0.28, 10).rotateZ(Math.PI / 2)

// Local matrices for every part of every vehicle type, computed once.
const rigs = Object.fromEntries(
  Object.entries(VEHICLES).map(([type, def]) => [
    type,
    {
      parts: def.parts.map((p) => ({
        p,
        glow: !!p[7],
        siren: p[6] === 'sirenA' || p[6] === 'sirenB',
        m: new Matrix4().makeTranslation(p[0], p[1], p[2]).multiply(new Matrix4().makeScale(p[3], p[4], p[5])),
      })),
    },
  ]),
)

const zero = new Matrix4().makeScale(0, 0, 0)
const base = new Matrix4()
const tmp = new Matrix4()
const spin = new Matrix4()
const q = new Quaternion()
const up = new Vector3(0, 1, 0)
const v3 = new Vector3()
const one = new Vector3(1, 1, 1)
const v3b = new Vector3()
const c = new Color()

if (!vehicles.length) initTraffic(city.spawn)

export default function Traffic() {
  const lit = useRef()
  const glow = useRef()
  const wheels = useRef()
  const shadows = useRef()
  const { rapier, world: physics } = useRapier()
  const glowMaterial = useMemo(() => unlit(), [])

  // Kinematic bodies so traffic pushes the player around but follows its own path.
  useEffect(() => {
    world.trafficColliders = new Set()
    vehicles.forEach((v) => {
      const half = VEHICLES[v.type].half
      v.body = physics.createRigidBody(rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(v.x, half[1], v.z))
      v.collider = physics.createCollider(rapier.ColliderDesc.cuboid(...half), v.body)
      v.colliderType = v.type
      world.trafficColliders.add(v.collider.handle)
    })
    return () => {
      vehicles.forEach((v) => {
        if (v.body) physics.removeRigidBody(v.body)
        v.body = v.collider = null
      })
    }
  }, [physics, rapier])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const game = useGame.getState()
    const driving = game.mode === 'car' && world.car
    const carPos = driving ? world.car.translation() : null
    updateTraffic(dt, {
      focus: world.focus,
      wanted: game.wanted,
      playerCar: carPos ? { x: carPos.x, z: carPos.z } : null,
      pedestrian: game.mode === 'foot' ? { x: world.focus.x, z: world.focus.z } : null,
    })

    const flip = Math.floor(performance.now() / 160) % 2 === 0
    const onFoot = game.mode === 'foot' && game.phase === 'playing' && !world.playerDown
    vehicles.forEach((v, i) => {
      const def = VEHICLES[v.type]
      const rig = rigs[v.type]

      // Damage: smoke, then fire, then a bang.
      const hoodX = Math.sin(v.yaw) * def.half[2] * 0.7
      const hoodZ = Math.cos(v.yaw) * def.half[2] * 0.7
      vehicleSmoke(v.x + hoodX, def.half[1] * 1.6, v.z + hoodZ, v.hp, TRAFFIC_HP, v.burning, dt)
      if (v.burning > 0) {
        v.burning -= dt
        if (v.burning <= 0) {
          wreckVehicle(v)
          explode(v.x, v.z, v)
        }
      }

      // Running someone over is bad for both of you. (Police on a chase pull
      // up to arrest you instead.)
      if (onFoot && v.speed > 4 && !v.chasing && (v.hitCooldown ?? 0) <= performance.now()) {
        const rx = world.focus.x - v.x
        const rz = world.focus.z - v.z
        const c = Math.cos(v.yaw)
        const s = Math.sin(v.yaw)
        if (Math.abs(rx * c - rz * s) < def.half[0] + 0.35 && Math.abs(rx * s + rz * c) < def.half[2] + 0.35) {
          hurtPlayer(Math.round(v.speed * 2.2), v.x, v.z, true)
          v.stall = 3
          v.hitCooldown = performance.now() + 1500
          honk()
        }
      }

      if (v.body && v.colliderType !== v.type) {
        world.trafficColliders.delete(v.collider.handle)
        physics.removeCollider(v.collider, true)
        v.collider = physics.createCollider(rapier.ColliderDesc.cuboid(...def.half), v.body)
        world.trafficColliders.add(v.collider.handle)
        v.colliderType = v.type
      }

      const x = v.x + v.offX
      const z = v.z + v.offZ
      q.setFromAxisAngle(up, v.yaw)
      if (v.body) {
        v.body.setNextKinematicTranslation({ x, y: def.half[1], z })
        v.body.setNextKinematicRotation(q)
      }
      base.compose(v3.set(x, def.half[1], z), q, one)

      const recolor = v.dirty || v.colored === undefined || (v.police && (v.chasing || v.sirenWasOn))
      for (let k = 0; k < MAX_PARTS; k++) {
        const slot = i * MAX_PARTS + k
        const part = rig.parts[k]
        if (!part) {
          lit.current.setMatrixAt(slot, zero)
          glow.current.setMatrixAt(slot, zero)
          continue
        }
        tmp.multiplyMatrices(base, part.m)
        lit.current.setMatrixAt(slot, part.glow ? zero : tmp)
        glow.current.setMatrixAt(slot, part.glow ? tmp : zero)
        if (recolor) (part.glow ? glow : lit).current.setColorAt(slot, c.set(partColor(part.p, v.color, v.chasing, flip)))
      }
      if (recolor) {
        v.dirty = false
        v.colored = true
        v.sirenWasOn = v.chasing
        if (lit.current.instanceColor) lit.current.instanceColor.needsUpdate = true
        if (glow.current.instanceColor) glow.current.instanceColor.needsUpdate = true
      }

      tmp.compose(v3.set(x, 0.03, z), q, v3b.set(def.half[0] * 2.6, 1, def.half[2] * 2.4))
      shadows.current.setMatrixAt(i, tmp)

      for (let k = 0; k < MAX_WHEELS; k++) {
        const w = def.wheels.at[k]
        const slot = i * MAX_WHEELS + k
        if (!w) {
          wheels.current.setMatrixAt(slot, zero)
          continue
        }
        tmp.multiplyMatrices(base, spin.makeTranslation(w[0], w[1], w[2]))
        tmp.multiply(spin.makeRotationX(v.spin))
        tmp.multiply(spin.makeScale(1, def.wheels.r, def.wheels.r))
        wheels.current.setMatrixAt(slot, tmp)
      }
    })
    lit.current.instanceMatrix.needsUpdate = true
    glow.current.instanceMatrix.needsUpdate = true
    wheels.current.instanceMatrix.needsUpdate = true
    shadows.current.instanceMatrix.needsUpdate = true
  })

  const count = vehicles.length
  return (
    <group>
      <instancedMesh ref={lit} args={[carBox, undefined, count * MAX_PARTS]} frustumCulled={false}>
        <meshToonMaterial gradientMap={toonRamp} />
      </instancedMesh>
      <instancedMesh ref={glow} args={[carBox, glowMaterial, count * MAX_PARTS]} frustumCulled={false} />
      <instancedMesh ref={wheels} args={[wheelGeometry, undefined, count * MAX_WHEELS]} frustumCulled={false}>
        <meshToonMaterial gradientMap={toonRamp} color="#1a1a1a" />
      </instancedMesh>
      <instancedMesh ref={shadows} args={[blobGeometry, blobMaterial, count]} frustumCulled={false} renderOrder={-1} />
    </group>
  )
}
