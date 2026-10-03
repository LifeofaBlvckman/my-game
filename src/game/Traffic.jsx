import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { BoxGeometry, Color, CylinderGeometry, InstancedBufferAttribute, Matrix4, PlaneGeometry, Quaternion, Vector3 } from 'three'
import { city, mulberry32 } from './cityData'
import { initTraffic, updateTraffic, vehicles } from './trafficSim'
import { MAX_PARTS, MAX_WHEELS, partColor, partKind, VEHICLES } from './vehicleTypes'
import { carBox, SHAPES } from './shapes'
import { explode, hurtPlayer, TRAFFIC_HP, vehicleSmoke, wreckVehicle } from './damage'
import { honk } from './audio'
import { toon, toonRamp, unlit } from './materials'
import { useGame, world } from './state'
import { blobGeometry, blobMaterial } from './Shadows'
import { driverFace, driverParts, seatMatrix } from './drivers'
import { COP_LOOK, randomLook } from './people'
import { FACE_COLS, getFaceAtlas } from './faces'

const wheelGeometry = new CylinderGeometry(1, 1, 0.28, 10).rotateZ(Math.PI / 2)
const KINDS = ['lit', 'trim', 'glow', 'glass']
const plainBox = new BoxGeometry(1, 1, 1)
const DRIVER_SLOTS = { sphere: 2, rbox: 2, capsule: 2 }

// Local matrices for every part of every vehicle type, split by kind
// (solid, glowing lights, see-through glass), computed once.
const rigs = Object.fromEntries(
  Object.entries(VEHICLES).map(([type, def]) => {
    const byKind = { lit: [], trim: [], glow: [], glass: [] }
    def.parts.forEach((p) => byKind[partKind(p)].push({ p, m: new Matrix4().makeTranslation(p[0], p[1], p[2]).multiply(new Matrix4().makeScale(p[3], p[4], p[5])) }))
    return [type, { byKind, seat: seatMatrix(def.seat) }]
  }),
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
const seatBase = new Matrix4()

if (!vehicles.length) initTraffic(city.spawn)
const lookRand = mulberry32(5150)
vehicles.forEach((v) => (v.civilian = randomLook(lookRand, { robe: false })))

const driverLook = (v) => (v.police ? COP_LOOK : v.civilian)
// Somebody is at the wheel unless the car is parked, wrecked, burning, or its
// driver just got out (a cop chasing you on foot, or a driver you dragged out).
const hasDriver = (v) => v.state !== 'parked' && !v.wrecked && !(v.burning > 0) && !v.officerOut

function createFaceMaterial() {
  const material = toon({ map: getFaceAtlas(), transparent: true, alphaTest: 0.05, depthWrite: false })
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aFace;')
      .replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
        vMapUv = (uv + vec2(mod(aFace, ${FACE_COLS}.0), ${FACE_COLS - 1}.0 - floor(aFace / ${FACE_COLS}.0))) / ${FACE_COLS}.0;`,
      )
  }
  return material
}

export default function Traffic() {
  const meshes = { lit: useRef(), trim: useRef(), glow: useRef(), glass: useRef() }
  const people = { sphere: useRef(), rbox: useRef(), capsule: useRef() }
  const faces = useRef()
  const wheels = useRef()
  const shadows = useRef()
  const { rapier, world: physics } = useRapier()
  const materials = useMemo(
    () => ({
      lit: toon(),
      trim: toon(),
      glow: unlit(),
      glass: toon({ transparent: true, opacity: 0.35, depthWrite: false }),
    }),
    [],
  )
  const faceMaterial = useMemo(createFaceMaterial, [])
  const faceGeometry = useMemo(() => {
    const g = new PlaneGeometry(1, 1)
    g.setAttribute('aFace', new InstancedBufferAttribute(new Float32Array(vehicles.length), 1))
    return g
  }, [])

  useLayoutEffect(() => {
    for (const mesh of [...Object.values(meshes), ...Object.values(people), faces, wheels]) {
      for (let i = 0; i < mesh.current.count; i++) mesh.current.setMatrixAt(i, zero)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    const faceAttr = faceGeometry.getAttribute('aFace')
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
        const cos = Math.cos(v.yaw)
        const sin = Math.sin(v.yaw)
        if (Math.abs(rx * cos - rz * sin) < def.half[0] + 0.35 && Math.abs(rx * sin + rz * cos) < def.half[2] + 0.35) {
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
      for (const kind of KINDS) {
        const mesh = meshes[kind].current
        const list = rig.byKind[kind]
        for (let k = 0; k < MAX_PARTS[kind]; k++) {
          const slot = i * MAX_PARTS[kind] + k
          const part = list[k]
          if (!part) {
            mesh.setMatrixAt(slot, zero)
            continue
          }
          mesh.setMatrixAt(slot, tmp.multiplyMatrices(base, part.m))
          if (recolor) mesh.setColorAt(slot, c.set(partColor(part.p, v.color, v.chasing, flip)))
        }
      }

      // The driver.
      const look = driverLook(v)
      if (v.driverRigFor !== look) {
        v.driverRigFor = look
        v.driverRig = driverParts(look)
        v.driverRecolor = true
        faceAttr.setX(i, look.face)
        faceAttr.needsUpdate = true
      }
      const seated = hasDriver(v)
      const used = { sphere: 0, rbox: 0, capsule: 0 }
      seatBase.multiplyMatrices(base, rig.seat)
      for (const p of v.driverRig) {
        const slot = i * DRIVER_SLOTS[p.shape] + used[p.shape]++
        const mesh = people[p.shape].current
        mesh.setMatrixAt(slot, seated ? tmp.multiplyMatrices(seatBase, p.m) : zero)
        if (v.driverRecolor) mesh.setColorAt(slot, c.set(p.color))
      }
      for (const shape of Object.keys(DRIVER_SLOTS)) {
        for (let k = used[shape]; k < DRIVER_SLOTS[shape]; k++) people[shape].current.setMatrixAt(i * DRIVER_SLOTS[shape] + k, zero)
      }
      faces.current.setMatrixAt(i, seated ? tmp.multiplyMatrices(seatBase, driverFace) : zero)

      if (recolor || v.driverRecolor) {
        v.dirty = false
        v.driverRecolor = false
        v.colored = true
        v.sirenWasOn = v.chasing
        for (const mesh of [...Object.values(meshes), ...Object.values(people)]) {
          if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
        }
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
    for (const mesh of [...Object.values(meshes), ...Object.values(people), faces, wheels, shadows]) mesh.current.instanceMatrix.needsUpdate = true
  })

  const count = vehicles.length
  return (
    <group>
      {KINDS.map((kind) => (
        <instancedMesh key={kind} ref={meshes[kind]} args={[kind === 'lit' ? carBox : plainBox, materials[kind], count * MAX_PARTS[kind]]} frustumCulled={false} />
      ))}
      {Object.entries(DRIVER_SLOTS).map(([shape, n]) => (
        <instancedMesh key={shape} ref={people[shape]} args={[SHAPES[shape], undefined, count * n]} frustumCulled={false}>
          <meshToonMaterial gradientMap={toonRamp} />
        </instancedMesh>
      ))}
      <instancedMesh ref={faces} args={[faceGeometry, faceMaterial, count]} frustumCulled={false} />
      <instancedMesh ref={wheels} args={[wheelGeometry, undefined, count * MAX_WHEELS]} frustumCulled={false}>
        <meshToonMaterial gradientMap={toonRamp} color="#1a1a1a" />
      </instancedMesh>
      <instancedMesh ref={shadows} args={[blobGeometry, blobMaterial, count]} frustumCulled={false} renderOrder={-1} />
    </group>
  )
}
