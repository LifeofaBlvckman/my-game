import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, InstancedBufferAttribute, Matrix4, PlaneGeometry, Quaternion, Vector3 } from 'three'
import { npcs, updatePedestrians } from './crowd'
import { computePose, FACE, jointMatrices, makeJoints, personParts, SLOTS } from './people'
import { inkOutline } from './outline'
import { FACE_COLS, getFaceAtlas } from './faces'
import { toon, toonRamp } from './materials'
import { SHAPES } from './shapes'
import { useGame, world } from './state'
import { weather } from './weather'
import { VEHICLES } from './vehicleTypes'
import { blobGeometry, blobMaterial } from './Shadows'

const DRAW_DISTANCE = 120 // people further away are only a few pixels tall
const SHAPE_NAMES = ['sphere', 'rbox', 'capsule', 'cone']
const OUTLINE_DISTANCE = 35 // people closer than this get the bold ink outline
const LOD_DISTANCE = 60 // beyond this, people update every third frame
const FAR_DISTANCE = 42 // beyond this, people drop their small details and cast no shadow
// Ears, noses and the like: too small to see from far away.
const tiny = (p) => p.size[0] * p.size[1] * p.size[2] < 0.0012

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

const base = new Matrix4()
const rot = new Matrix4()
const q = new Quaternion()
const v = new Vector3()
const s = new Vector3()
const up = new Vector3(0, 1, 0)
const lying = new Matrix4().makeRotationX(-Math.PI / 2).premultiply(new Matrix4().makeTranslation(0, 0.14, 0))
const faceLocal = new Matrix4().makeTranslation(...FACE.offset).multiply(new Matrix4().makeScale(FACE.size[0], FACE.size[1], 1))
const joints = makeJoints()
const pose = {}
const poseIn = {}
const color = new Color()

export default function Pedestrians() {
  const meshes = { sphere: useRef(), rbox: useRef(), capsule: useRef(), cone: useRef() }
  const lines = { sphere: useRef(), rbox: useRef(), capsule: useRef(), cone: useRef() }
  const fars = { sphere: useRef(), rbox: useRef(), capsule: useRef(), cone: useRef() }
  const faces = useRef()
  const shadows = useRef()
  const faceMaterial = useMemo(createFaceMaterial, [])
  const faceGeometry = useMemo(() => {
    const g = new PlaneGeometry(1, 1)
    g.setAttribute('aFace', new InstancedBufferAttribute(new Float32Array(npcs.map((n) => n.look.face)), 1))
    return g
  }, [])
  const rigs = useMemo(
    () => npcs.map((n) => ({ parts: personParts(n.look).map((p) => ({ ...p, world: new Matrix4() })), face: new Matrix4(), shadow: new Matrix4() })),
    [],
  )
  const frame = useRef(0)

  // Only people within draw distance are drawn, packed into the first
  // instance slots each frame. A slot is only recolored when someone new
  // takes it over, which is rare since the order barely changes.
  const owners = useMemo(
    () => ({
      sphere: new Int32Array(npcs.length * SLOTS.sphere).fill(-1),
      rbox: new Int32Array(npcs.length * SLOTS.rbox).fill(-1),
      capsule: new Int32Array(npcs.length * SLOTS.capsule).fill(-1),
      cone: new Int32Array(npcs.length * SLOTS.cone).fill(-1),
      face: new Int32Array(npcs.length).fill(-1),
      far: {
        sphere: new Int32Array(npcs.length * SLOTS.sphere).fill(-1),
        rbox: new Int32Array(npcs.length * SLOTS.rbox).fill(-1),
        capsule: new Int32Array(npcs.length * SLOTS.capsule).fill(-1),
        cone: new Int32Array(npcs.length * SLOTS.cone).fill(-1),
      },
    }),
    [],
  )

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const game = useGame.getState()
    const driving = game.mode === 'car' && world.car
    let car = null
    if (driving) {
      const t = world.car.translation()
      car = { x: t.x, z: t.z, yaw: world.heading, speed: world.carSpeed ?? 0, half: VEHICLES[game.carType].half }
    }
    // While you're indoors, the street carries on around the door you went in by.
    const hits = updatePedestrians(dt, world.simFocus ?? world.focus, car, game.mode === 'foot' && !world.playerDown && !game.inside, world.events)
    if (hits.length) world.events.push({ type: 'pedHit', hits })

    const fx = world.focus.x
    const fz = world.focus.z
    const time = clock.elapsedTime
    const cursor = { sphere: 0, rbox: 0, capsule: 0, cone: 0 }
    const lineCursor = { sphere: 0, rbox: 0, capsule: 0, cone: 0 }
    const farCursor = { sphere: 0, rbox: 0, capsule: 0, cone: 0 }
    let farRecolored = false
    let faceCursor = 0
    let recolored = false
    const faceAttr = faceGeometry.getAttribute('aFace')
    frame.current++

    npcs.forEach((n, i) => {
      const dx = n.x - fx
      const dz = n.z - fz
      const d2 = dx * dx + dz * dz
      if (d2 > DRAW_DISTANCE * DRAW_DISTANCE || n.active === false || n.away || n.x === undefined) {
        n.posed = false
        return
      }
      const rig = rigs[i]
      // Far away, only re-pose every third frame and reuse the last matrices.
      const repose = !n.posed || d2 < LOD_DISTANCE * LOD_DISTANCE || (frame.current + i) % 3 === 0
      if (repose) {
        n.posed = true
        const fast = n.panic > 0 || n.fight > 0 || n.kind === 'cop' || !!n.brawlWith || n.chasePlayer || (n.kind === 'walk' && weather.rain > 0.4)
        n.phase += rawDt * (n.moving ? (fast ? 11 : 7.5) : 0)
        poseIn.phase = n.phase
        poseIn.t = time + i
        poseIn.moving = n.moving && n.down <= 0
        poseIn.run = fast
        poseIn.punch = n.punchT ?? -1
        poseIn.punchSide = n.punchSide ?? 1
        poseIn.flinch = n.flinch > 0 ? n.flinch / 0.4 : 0
        computePose(pose, poseIn)
        if (n.aim > 0 && n.down <= 0) {
          // Gun up: right arm straight out at the target, left hand steadying it.
          const k = n.aim
          pose.armR = pose.armR * (1 - k) - 1.5 * k
          pose.foreR = pose.foreR * (1 - k) - 0.04 * k
          pose.armL = pose.armL * (1 - k) - 1.25 * k
          pose.foreL = pose.foreL * (1 - k) - 0.55 * k
          pose.splayL = 0.32 * k
          pose.twist = 0.12 * k
          pose.lean = Math.min(pose.lean, 0.06)
        }
        const still = n.down <= 0 && !(n.panic > 0) && !(n.fight > 0)
        if (n.role === 'hawker' && still) {
          // One hand up steadying the tray on the head.
          pose.armR = -2.95
          pose.foreR = -0.45
          pose.splayR = -0.25
        } else if (n.role === 'preacher' && still && !poseIn.moving) {
          // Bible held to the chest, the other hand raised to heaven.
          const beat = Math.sin(time * 1.6 + i)
          pose.armL = -0.95
          pose.foreL = -1.5
          pose.armR = -2.3 - beat * 0.5
          pose.foreR = -0.3 + Math.min(0, beat) * 0.5
          pose.headNod = -0.12 + beat * 0.08
          pose.lean = 0.08 * beat
        } else if (n.role === 'chat' && still && !poseIn.moving) {
          // Gisting: talking with the hands, taking turns.
          const talk = Math.sin(time * 0.5 + (n.group ?? 0) * 1.7 + i * 2.1) > 0.2
          if (talk) {
            const g = Math.sin(time * 3 + i)
            pose.armR = -0.7 + g * 0.35
            pose.foreR = -1.3 - g * 0.3
            pose.armL = -0.3 - Math.max(0, -g) * 0.3
            pose.foreL = -0.9
            pose.headNod = Math.sin(time * 4 + i) * 0.08
          } else {
            pose.armL = pose.armR = 0.15
            pose.foreL = pose.foreR = -0.3
            pose.headTilt = 0.1
          }
        } else if (n.watching && !poseIn.moving && still) {
          // Watching a fight: fists in the air now and then.
          const cheer = Math.sin(time * 1.3 + i * 1.9) > 0.3
          if (cheer) {
            const pump = Math.sin(time * 7 + i)
            pose.armR = -2.7 - pump * 0.3
            pose.foreR = -0.5
            pose.armL = -2.4 + pump * 0.3
            pose.foreL = -0.6
            pose.bob = Math.abs(pump) * 0.04
          }
        }
        if (n.role === 'warden' && !poseIn.moving && n.down <= 0 && !(n.panic > 0)) {
          // Directing traffic: one arm out, the other waving cars through.
          const wave = Math.sin(time * 3.2 + i)
          pose.armR = -1.55 + wave * 0.45
          pose.foreR = -0.5 - Math.max(0, wave) * 0.5
          pose.armL = -1.4
          pose.foreL = -0.1
          pose.twist = Math.sin(time * 0.4 + i) * 0.5
        }
        const calm = !poseIn.moving && n.down <= 0 && !(n.panic > 0) && !(n.fight > 0)
        if (n.role === 'soldier' && calm) {
          if (n.drill) {
            // Drill: marching on the spot, arms swinging stiff, in step.
            const step = Math.sin(time * 4.2)
            pose.legL = -0.55 * Math.max(0, step)
            pose.legR = -0.55 * Math.max(0, -step)
            pose.shinL = 0.9 * Math.max(0, step)
            pose.shinR = 0.9 * Math.max(0, -step)
            pose.armL = 0.6 * step
            pose.armR = -0.6 * step
            pose.foreL = pose.foreR = -0.05
          } else if (n.lookout) {
            // Up the tower, scanning the street.
            pose.twist = Math.sin(time * 0.35 + i) * 0.7
            pose.armR = -2.6
            pose.foreR = -1.6
          } else {
            // At attention by the gate.
            pose.armL = pose.armR = 0
            pose.foreL = pose.foreR = -0.05
            pose.splayL = 0.04
            pose.splayR = -0.04
          }
        } else if (n.role === 'thug' && calm) {
          if (n.demanding) {
            // "Settle us!": one hand out, palm up, the other waving.
            pose.armR = -1.25
            pose.foreR = -0.35
            pose.armL = -0.9 + Math.sin(time * 5 + i) * 0.3
            pose.foreL = -1.3
            pose.headNod = -0.08
          } else {
            // Loafing: arms folded, weight shifting.
            pose.armL = pose.armR = -0.55
            pose.foreL = pose.foreR = -2.2
            pose.twist = Math.sin(time * 0.6 + i * 2) * 0.15
            pose.lean = -0.05
          }
        }
        if (n.grab) {
          // An officer taking hold of you.
          pose.armL = pose.armR = -1.35
          pose.foreL = pose.foreR = -0.25
        }
        if (n.down > 0) {
          pose.bob = pose.lean = pose.twist = pose.headTilt = pose.headNod = 0
          pose.sy = pose.sxz = 1
          pose.legL = pose.legR = 0.2
          pose.shinL = pose.shinR = 0.35
          pose.armL = pose.armR = -2.6
          pose.foreL = pose.foreR = -0.3
        }
        jointMatrices(pose, joints)
        const h = n.look.height
        q.setFromAxisAngle(up, n.yaw)
        base.compose(v.set(n.x + n.ox, n.y, n.z + n.oz), q, s.set(h, h, h))
        if (n.down > 0) base.multiply(lying)
        for (const p of rig.parts) p.world.multiplyMatrices(base, rot.multiplyMatrices(joints[p.joint], p.local))
        rig.face.multiplyMatrices(base, rot.multiplyMatrices(joints.head, faceLocal))
        rig.shadow.makeScale(n.down > 0 ? 1.2 : 0.9, 1, n.down > 0 ? 2 : 0.9).setPosition(n.x + n.ox, n.y + 0.02, n.z + n.oz)
      }

      const outlined = d2 < OUTLINE_DISTANCE * OUTLINE_DISTANCE
      const far = d2 > FAR_DISTANCE * FAR_DISTANCE
      for (let k = 0; k < rig.parts.length; k++) {
        const p = rig.parts[k]
        if (!far) break
        if (tiny(p)) continue
        const slot = farCursor[p.shape]++
        const mesh = fars[p.shape].current
        mesh.setMatrixAt(slot, p.world)
        const id = i * 32 + k
        if (owners.far[p.shape][slot] !== id) {
          owners.far[p.shape][slot] = id
          mesh.setColorAt(slot, color.set(p.color))
          farRecolored = true
        }
      }
      for (let k = 0; k < rig.parts.length && !far; k++) {
        const p = rig.parts[k]
        const slot = cursor[p.shape]++
        const mesh = meshes[p.shape].current
        mesh.setMatrixAt(slot, p.world)
        if (outlined) lines[p.shape].current.setMatrixAt(lineCursor[p.shape]++, p.world)
        const id = i * 32 + k
        if (owners[p.shape][slot] !== id) {
          owners[p.shape][slot] = id
          mesh.setColorAt(slot, color.set(p.color))
          recolored = true
        }
      }
      const fslot = faceCursor++
      faces.current.setMatrixAt(fslot, rig.face)
      shadows.current.setMatrixAt(fslot, rig.shadow)
      if (owners.face[fslot] !== i) {
        owners.face[fslot] = i
        faceAttr.setX(fslot, n.look.face)
        faceAttr.needsUpdate = true
      }
    })

    SHAPE_NAMES.forEach((name) => {
      const farMesh = fars[name].current
      farMesh.count = farCursor[name]
      farMesh.instanceMatrix.needsUpdate = true
      if (farRecolored && farMesh.instanceColor) farMesh.instanceColor.needsUpdate = true
      const mesh = meshes[name].current
      mesh.count = cursor[name]
      mesh.instanceMatrix.needsUpdate = true
      const line = lines[name].current
      line.count = lineCursor[name]
      line.instanceMatrix.needsUpdate = true
      if (recolored && mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    })
    faces.current.count = shadows.current.count = faceCursor
    faces.current.instanceMatrix.needsUpdate = true
    shadows.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      {SHAPE_NAMES.map((name) => (
        <instancedMesh key={name} ref={meshes[name]} args={[SHAPES[name], undefined, npcs.length * SLOTS[name]]} frustumCulled={false}>
          <meshToonMaterial gradientMap={toonRamp} />
        </instancedMesh>
      ))}
      {/* Far away: the same people with fewer parts, and no shadow */}
      {SHAPE_NAMES.map((name) => (
        <instancedMesh key={`${name}-far`} ref={fars[name]} args={[SHAPES[name], undefined, npcs.length * SLOTS[name]]} frustumCulled={false} userData={{ noShadow: true }}>
          <meshToonMaterial gradientMap={toonRamp} />
        </instancedMesh>
      ))}
      {SHAPE_NAMES.map((name) => (
        <instancedMesh key={`${name}-line`} ref={lines[name]} args={[SHAPES[name], inkOutline, npcs.length * SLOTS[name]]} frustumCulled={false} userData={{ noShadow: true }} />
      ))}
      <instancedMesh ref={faces} args={[faceGeometry, faceMaterial, npcs.length]} frustumCulled={false} />
      <instancedMesh ref={shadows} args={[blobGeometry, blobMaterial, npcs.length]} frustumCulled={false} renderOrder={-1} />
    </group>
  )
}
