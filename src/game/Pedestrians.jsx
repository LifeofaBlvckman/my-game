import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, InstancedBufferAttribute, Matrix4, PlaneGeometry, Quaternion, Vector3 } from 'three'
import { npcs, updatePedestrians } from './crowd'
import { computePose, FACE, NECK, personParts, SLOTS } from './people'
import { FACE_COLS, getFaceAtlas } from './faces'
import { toon, toonRamp } from './materials'
import { SHAPES } from './shapes'
import { useGame, world } from './state'
import { VEHICLES } from './vehicleTypes'
import { blobGeometry, blobMaterial } from './Shadows'

const DRAW_DISTANCE = 150
const SHAPE_NAMES = ['sphere', 'rbox', 'capsule']
const SPLAY = { armL: 0.06, armR: -0.06 }
const LOD_DISTANCE = 60 // beyond this, people update every third frame

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

const M = () => new Matrix4()
const base = M()
const head = M()
const tmp = M()
const rot = M()
const q = new Quaternion()
const v = new Vector3()
const s = new Vector3()
const up = new Vector3(0, 1, 0)
const lying = new Matrix4().makeRotationX(-Math.PI / 2).premultiply(new Matrix4().makeTranslation(0, 0.14, 0))
const neck = new Matrix4().makeTranslation(...NECK)
const faceLocal = new Matrix4().makeTranslation(...FACE.offset).multiply(new Matrix4().makeScale(FACE.size[0], FACE.size[1], 1))
const pose = {}
const poseIn = {}
const color = new Color()

// Each NPC's parts with their local matrices prebuilt.
function buildRig(n) {
  return personParts(n.look).map((p) => {
    const scale = new Matrix4().makeScale(...p.size)
    if (p.group.startsWith('leg') || p.group.startsWith('arm')) {
      return {
        ...p,
        pivotM: new Matrix4().makeTranslation(...p.pivot).multiply(new Matrix4().makeRotationZ(SPLAY[p.group] ?? 0)),
        localM: new Matrix4().makeTranslation(...p.offset).multiply(scale),
      }
    }
    const origin = p.group === 'head' ? p.offset : p.pivot.map((c, k) => c + p.offset[k])
    return { ...p, localM: new Matrix4().makeTranslation(...origin).multiply(scale) }
  })
}

export default function Pedestrians() {
  const meshes = { sphere: useRef(), rbox: useRef(), capsule: useRef() }
  const faces = useRef()
  const shadows = useRef()
  const faceMaterial = useMemo(createFaceMaterial, [])
  const faceGeometry = useMemo(() => {
    const g = new PlaneGeometry(1, 1)
    g.setAttribute('aFace', new InstancedBufferAttribute(new Float32Array(npcs.map((n) => n.look.face)), 1))
    return g
  }, [])
  const rigs = useMemo(
    () => npcs.map((n) => ({ parts: buildRig(n).map((p) => ({ ...p, world: new Matrix4() })), face: new Matrix4(), shadow: new Matrix4() })),
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
      face: new Int32Array(npcs.length).fill(-1),
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
    const cursor = { sphere: 0, rbox: 0, capsule: 0 }
    let faceCursor = 0
    let recolored = false
    const faceAttr = faceGeometry.getAttribute('aFace')
    frame.current++

    npcs.forEach((n, i) => {
      const dx = n.x - fx
      const dz = n.z - fz
      const d2 = dx * dx + dz * dz
      if (d2 > DRAW_DISTANCE * DRAW_DISTANCE || n.active === false || n.x === undefined) {
        n.posed = false
        return
      }
      const rig = rigs[i]
      // Far away, only re-pose every third frame and reuse the last matrices.
      const repose = !n.posed || d2 < LOD_DISTANCE * LOD_DISTANCE || (frame.current + i) % 3 === 0
      if (repose) {
        n.posed = true
        const fast = n.panic > 0 || n.fight > 0 || n.kind === 'cop'
        n.phase += rawDt * (n.moving ? (fast ? 11 : 7.5) : 0)
        poseIn.phase = n.phase
        poseIn.t = time + i
        poseIn.moving = n.moving && n.down <= 0
        poseIn.run = fast
        poseIn.punch = n.punchT ?? -1
        poseIn.punchSide = n.punchSide ?? 1
        poseIn.flinch = n.flinch > 0 ? n.flinch / 0.4 : 0
        computePose(pose, poseIn)
        if (n.grab) pose.armL = pose.armR = -1.35 // an officer taking hold of you
        if (n.down > 0) {
          pose.bob = pose.lean = pose.twist = pose.headTilt = pose.headNod = 0
          pose.sy = pose.sxz = 1
          pose.legL = pose.legR = 0.2
          pose.armL = pose.armR = -2.6
        }
        const h = n.look.height
        q.setFromAxisAngle(up, n.yaw + pose.twist)
        base.compose(v.set(n.x + n.ox, n.y + pose.bob, n.z + n.oz), q, s.set(h * pose.sxz, h * pose.sy, h * pose.sxz))
        if (n.down > 0) base.multiply(lying)
        else base.multiply(rot.makeRotationX(pose.lean))
        head.multiplyMatrices(base, neck).multiply(rot.makeRotationX(pose.headNod)).multiply(rot.makeRotationZ(pose.headTilt))
        for (const p of rig.parts) {
          if (p.pivotM) p.world.multiplyMatrices(base, p.pivotM).multiply(rot.makeRotationX(pose[p.group])).multiply(p.localM)
          else p.world.multiplyMatrices(p.group === 'head' ? head : base, p.localM)
        }
        rig.face.multiplyMatrices(head, faceLocal)
        rig.shadow.makeScale(n.down > 0 ? 1.2 : 0.9, 1, n.down > 0 ? 2 : 0.9).setPosition(n.x + n.ox, n.y + 0.02, n.z + n.oz)
      }

      for (let k = 0; k < rig.parts.length; k++) {
        const p = rig.parts[k]
        const slot = cursor[p.shape]++
        const mesh = meshes[p.shape].current
        mesh.setMatrixAt(slot, p.world)
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
      const mesh = meshes[name].current
      mesh.count = cursor[name]
      mesh.instanceMatrix.needsUpdate = true
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
      <instancedMesh ref={faces} args={[faceGeometry, faceMaterial, npcs.length]} frustumCulled={false} />
      <instancedMesh ref={shadows} args={[blobGeometry, blobMaterial, npcs.length]} frustumCulled={false} renderOrder={-1} />
    </group>
  )
}
