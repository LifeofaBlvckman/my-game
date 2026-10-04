import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { BoxGeometry, Color, CylinderGeometry, InstancedBufferAttribute, Matrix4, PlaneGeometry, Quaternion, TorusGeometry, Vector3 } from 'three'
import { city, mulberry32 } from './cityData'
import { initTraffic, updateTraffic, vehicles } from './trafficSim'
import { MAX_PARTS, MAX_PASSENGERS, MAX_WHEELS, partColor, partKind, VEHICLES } from './vehicleTypes'
import { carBox, SHAPES } from './shapes'
import { explode, hurtPlayer, TRAFFIC_HP, vehicleSmoke, wreckVehicle } from './damage'
import { ENGINE_VOICES, trafficHorn, updateTrafficAudio } from './audio'
import { toon, toonRamp, unlit } from './materials'
import { rimGeometry } from './Car'
import { useGame, world } from './state'
import { blobGeometry, blobMaterial } from './Shadows'
import { DRIVER_SLOTS, driverFace, driverParts, seatMatrix, steeringWheel } from './drivers'
import { alightRiders, callBoarders, waitingCounts } from './crowd'
import { city as cityMap } from './cityData'
import { COP_LOOK, randomLook, WARDEN_LOOK } from './people'
import { FACE_COLS, getFaceAtlas } from './faces'
import { runsVehicle, updateWorldSync } from './worldSync'
// Missions park cars too (Baba Femi's danfo): load them before traffic is set up.
import './quests'

const wheelGeometry = new CylinderGeometry(1, 1, 0.28, 14).rotateZ(Math.PI / 2)
const KINDS = ['lit', 'trim', 'glow', 'glass']
const SEATS = 1 + MAX_PASSENGERS // driver plus passengers
const wheelRing = new TorusGeometry(0.18, 0.025, 5, 14)
const plainBox = new BoxGeometry(1, 1, 1)

// Local matrices for every part of every vehicle type, split by kind
// (solid, glowing lights, see-through glass), computed once.
const rigs = Object.fromEntries(
  Object.entries(VEHICLES).map(([type, def]) => {
    const byKind = { lit: [], trim: [], glow: [], glass: [] }
    def.parts.forEach((p) => byKind[partKind(p)].push({ p, m: new Matrix4().makeTranslation(p[0], p[1], p[2]).multiply(new Matrix4().makeScale(p[3], p[4], p[5])) }))
    return [type, { byKind, seats: [def.seat, ...def.passengers].map(seatMatrix) }]
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
const camDir = new Vector3()
const listener = { x: 0, z: 0, rightX: 1, rightZ: 0 }
const heard = []

// Who honks, and when: at you if you're in the way, in a jam now and then,
// and the odd Lagos "I'm here!" toot for no reason at all.
function hornLogic(v, dt, now) {
  if (v.state !== 'lane' || !hasDriver(v) || (v.hornAt ?? 0) > now) return
  const d = Math.hypot(v.x - listener.x, v.z - listener.z)
  if (d > 50) return
  const danfo = v.type === 'danfo' || v.type === 'keke'
  let blast = null
  if (v.blockedBy === 'player' && v.blockedFor > 1.2) blast = [0.35 + Math.random() * 0.4, danfo ? 3 : 2, 2.2 + Math.random() * 2]
  else if (v.blockedBy === 'queue' && v.blockedFor > 4 && Math.random() < dt * 0.12) blast = [0.5, 1, 6]
  else if (v.speed > 3 && Math.random() < dt * (danfo ? 0.05 : 0.015)) blast = [0.12, danfo ? 2 : 1, 8]
  if (!blast) return
  trafficHorn(v.type, v.x, v.z, listener, blast[0], blast[1])
  v.hornAt = now + blast[2] * 1000
}

if (!vehicles.length) initTraffic(city.spawn)
const lookRand = mulberry32(5150)
vehicles.forEach((v) => (v.civilian = randomLook(lookRand, { robe: false })))

// People in cars within this distance of the camera are drawn.
const OCCUPANTS_NEAR = 90
// A number for each look, so a seat slot knows when someone else sits in it.
const lookIds = new WeakMap()
let nextLook = 1
const lookId = (look) => lookIds.get(look) ?? (lookIds.set(look, nextLook++), nextLook - 1)
const seatOwners = Object.fromEntries([...Object.entries(DRIVER_SLOTS).map(([shape, n]) => [shape, new Int32Array(vehicles.length * SEATS * n).fill(-1)]), ['face', new Int32Array(vehicles.length * SEATS).fill(-1)]])

const driverLook = (v) => (v.police ? COP_LOOK : v.type === 'lastma' ? WARDEN_LOOK : v.civilian)
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
  const people = { sphere: useRef(), rbox: useRef(), capsule: useRef(), cone: useRef() }
  const faces = useRef()
  const wheels = useRef()
  const rims = useRef()
  const steering = useRef()
  const shadows = useRef()
  const { rapier, world: physics } = useRapier()
  const camera = useThree((s) => s.camera)
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
    g.setAttribute('aFace', new InstancedBufferAttribute(new Float32Array(vehicles.length * SEATS), 1))
    return g
  }, [])

  useLayoutEffect(() => {
    for (const mesh of [...Object.values(meshes), ...Object.values(people), faces, wheels, rims, steering]) {
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

  // Take a vehicle off the map: no parts drawn, its body out of the way.
  const hideVehicle = (i, v) => {
    if (v.hidden) return
    v.hidden = true
    v.body?.setNextKinematicTranslation({ x: v.x, y: -60, z: v.z })
    for (const kind of KINDS) for (let k = 0; k < MAX_PARTS[kind]; k++) meshes[kind].current.setMatrixAt(i * MAX_PARTS[kind] + k, zero)
    steering.current.setMatrixAt(i, zero)
    shadows.current.setMatrixAt(i, zero)
    for (let k = 0; k < MAX_WHEELS; k++) {
      wheels.current.setMatrixAt(i * MAX_WHEELS + k, zero)
      rims.current.setMatrixAt(i * MAX_WHEELS + k, zero)
    }
  }

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const game = useGame.getState()
    const driving = game.mode === 'car' && world.car
    const carPos = driving ? world.car.translation() : null
    const waiting = waitingCounts()
    // Online: send our share of the city, take in everyone else's.
    updateWorldSync()
    updateTraffic(dt, {
      waiting,
      foci: world.foci,
      focus: world.simFocus ?? world.focus,
      wanted: game.wanted,
      // Police go where they last saw you (GameLogic keeps track).
      chase: world.lastSeen,
      hidden: game.evading,
      playerCar: carPos ? { x: carPos.x, z: carPos.z } : null,
      // Which way you're heading, so the police can try to cut you off.
      playerVel: game.inside ? null : (driving ? world.car : world.player)?.linvel(),
      pedestrian: game.mode === 'foot' ? { x: world.focus.x, z: world.focus.z } : null,
    })

    // The camera is the listener for engine noise and horns.
    camera.getWorldDirection(camDir)
    listener.x = camera.position.x
    listener.z = camera.position.z
    const flat = Math.hypot(camDir.x, camDir.z) || 1
    listener.rightX = -camDir.z / flat
    listener.rightZ = camDir.x / flat
    world.listener = listener
    const now = performance.now()
    const muted = !!game.inside || game.phase === 'title'

    const flip = Math.floor(performance.now() / 160) % 2 === 0
    const onFoot = game.mode === 'foot' && game.phase === 'playing' && !world.playerDown
    const faceAttr = faceGeometry.getAttribute('aFace')
    const seatCursor = { sphere: 0, rbox: 0, capsule: 0, cone: 0 }
    let faceCursor = 0
    let peopleRecolor = false
    vehicles.forEach((v, i) => {
      const def = VEHICLES[v.type]
      const rig = rigs[v.type]
      const runs = runsVehicle(v)

      // Online, somewhere out of everyone's sight that its owner isn't
      // telling us about: not on our map at all.
      if (v.away) {
        hideVehicle(i, v)
        return
      }
      if (v.hidden) {
        v.hidden = false
        v.dirty = true
      }

      // Damage: smoke, then fire, then a bang.
      const hoodX = Math.sin(v.yaw) * def.half[2] * 0.7
      const hoodZ = Math.cos(v.yaw) * def.half[2] * 0.7
      vehicleSmoke(v.x + hoodX, def.half[1] * 1.6, v.z + hoodZ, v.hp, TRAFFIC_HP, v.burning, dt)
      if (v.burning > 0 && runs) {
        v.burning -= dt
        if (v.burning <= 0) {
          wreckVehicle(v)
          explode(v.x, v.z, v)
        }
      }

      if (!muted) hornLogic(v, dt, now)

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
          trafficHorn(v.type, v.x, v.z, listener, 0.6, 1)
          v.hornAt = now + 3000
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

      const flashing = v.chasing || v.lastmaOn
      const recolor = v.dirty || v.colored === undefined || ((v.police || v.type === 'lastma') && (flashing || v.sirenWasOn))
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
          if (recolor) mesh.setColorAt(slot, c.set(partColor(part.p, v.color, flashing, flip)))
        }
      }

      // Passengers: drop them at the stop, then load whoever is waiting.
      if (v.dwellNew && runs) {
        v.dwellNew = false
        if (v.riders.length) alightRiders(v.dwellStop, v, Math.ceil(v.riders.length * Math.random()))
        callBoarders(v.dwellStop, v, def.passengers.length - v.riders.length)
      }
      if (runs && (v.dropRiders || ((v.wrecked || v.burning > 0) && v.riders.length))) {
        // Teleported or wrecked: everyone gets off at the nearest stop.
        v.dropRiders = false
        let near = cityMap.busStops[0]
        for (const st of cityMap.busStops) if (Math.hypot(st.x - v.x, st.z - v.z) < Math.hypot(near.x - v.x, near.z - v.z)) near = st
        if (v.riders.length) alightRiders(near, { ...v, x: near.x, z: near.z, riders: v.riders })
      }

      // Who's on board: the driver (if any) and the riders, each in a seat.
      // Only cars near the camera get people drawn in them; they're packed
      // into the first instance slots, and a slot is only recoloured when
      // someone different takes it over.
      const look = driverLook(v)
      if (v.driverRigFor !== look) {
        v.driverRigFor = look
        v.driverRig = driverParts(look)
      }
      const seen = Math.hypot(x - listener.x, z - listener.z) < OCCUPANTS_NEAR
      if (seen) {
        const occupants = [hasDriver(v) ? { rig: v.driverRig, look } : null]
        v.riderRigs ??= new Map()
        for (const r of v.riders.slice(0, def.passengers.length)) {
          if (!v.riderRigs.has(r)) v.riderRigs.set(r, driverParts(r.look, false))
          occupants.push({ rig: v.riderRigs.get(r), look: r.look })
        }
        for (let seat = 0; seat < occupants.length; seat++) {
          const occ = occupants[seat]
          if (!occ || !rig.seats[seat]) continue
          seatBase.multiplyMatrices(base, rig.seats[seat])
          const who = lookId(occ.look) * 64
          occ.rig.forEach((p, k) => {
            const slot = seatCursor[p.shape]++
            const mesh = people[p.shape].current
            mesh.setMatrixAt(slot, tmp.multiplyMatrices(seatBase, p.m))
            if (seatOwners[p.shape][slot] !== who + k) {
              seatOwners[p.shape][slot] = who + k
              mesh.setColorAt(slot, c.set(p.color))
              peopleRecolor = true
            }
          })
          const fslot = faceCursor++
          faces.current.setMatrixAt(fslot, tmp.multiplyMatrices(seatBase, driverFace))
          if (seatOwners.face[fslot] !== who) {
            seatOwners.face[fslot] = who
            faceAttr.setX(fslot, occ.look.face)
            faceAttr.needsUpdate = true
          }
        }
      }
      seatBase.multiplyMatrices(base, rig.seats[0])
      steering.current.setMatrixAt(i, tmp.multiplyMatrices(seatBase, steeringWheel))

      if (recolor) {
        v.dirty = false
        v.colored = true
        v.sirenWasOn = flashing
        for (const mesh of Object.values(meshes)) {
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
          rims.current.setMatrixAt(slot, zero)
          continue
        }
        tmp.multiplyMatrices(base, spin.makeTranslation(w[0], w[1], w[2]))
        tmp.multiply(spin.makeRotationX(v.spin))
        tmp.multiply(spin.makeScale(1, def.wheels.r, def.wheels.r))
        wheels.current.setMatrixAt(slot, tmp)
        rims.current.setMatrixAt(slot, tmp)
      }
    })
    for (const shape of Object.keys(DRIVER_SLOTS)) {
      const mesh = people[shape].current
      mesh.count = seatCursor[shape]
      if (peopleRecolor && mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
    faces.current.count = faceCursor
    for (const mesh of [...Object.values(meshes), ...Object.values(people), faces, wheels, rims, steering, shadows]) mesh.current.instanceMatrix.needsUpdate = true

    // Engines: the few closest vehicles with somebody at the wheel.
    heard.length = 0
    for (const v of vehicles) {
      if (!hasDriver(v) || v.away) continue
      const d = Math.hypot(v.x - listener.x, v.z - listener.z)
      if (d < 55) heard.push({ d, x: v.x, z: v.z, speed: v.speed, type: v.type })
    }
    heard.sort((a, b) => a.d - b.d)
    if (heard.length > ENGINE_VOICES) heard.length = ENGINE_VOICES
    updateTrafficAudio(heard, listener, muted)
  })

  const count = vehicles.length
  return (
    <group>
      {KINDS.map((kind) => (
        <instancedMesh key={kind} ref={meshes[kind]} args={[kind === 'lit' ? carBox : plainBox, materials[kind], count * MAX_PARTS[kind]]} frustumCulled={false} />
      ))}
      {Object.entries(DRIVER_SLOTS).map(([shape, n]) => (
        <instancedMesh key={shape} ref={people[shape]} args={[SHAPES[shape], undefined, count * SEATS * n]} frustumCulled={false}>
          <meshToonMaterial gradientMap={toonRamp} />
        </instancedMesh>
      ))}
      <instancedMesh ref={faces} args={[faceGeometry, faceMaterial, count * SEATS]} frustumCulled={false} />
      <instancedMesh ref={steering} args={[wheelRing, undefined, count]} frustumCulled={false}>
        <meshToonMaterial gradientMap={toonRamp} color="#1a1a1a" />
      </instancedMesh>
      <instancedMesh ref={wheels} args={[wheelGeometry, undefined, count * MAX_WHEELS]} frustumCulled={false}>
        <meshToonMaterial gradientMap={toonRamp} color="#1a1a1a" />
      </instancedMesh>
      <instancedMesh ref={rims} args={[rimGeometry, undefined, count * MAX_WHEELS]} frustumCulled={false}>
        <meshToonMaterial gradientMap={toonRamp} color="#c9ccd1" />
      </instancedMesh>
      <instancedMesh ref={shadows} args={[blobGeometry, blobMaterial, count]} frustumCulled={false} renderOrder={-1} />
    </group>
  )
}
