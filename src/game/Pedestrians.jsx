import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, InstancedBufferAttribute, Matrix4, PlaneGeometry, Quaternion, Vector3 } from 'three'
import { npcs, updatePedestrians } from './crowd'
import { FACE, personParts, SLOTS } from './people'
import { FACE_COLS, getFaceAtlas } from './faces'
import { toon, toonRamp } from './materials'
import { unitBox } from './Instances'
import { useGame, world } from './state'
import { VEHICLES } from './vehicleTypes'
import { blobGeometry, blobMaterial } from './Shadows'

const DRAW_DISTANCE = 150

function createFaceMaterial() {
  const material = toon({ map: getFaceAtlas() })
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
const tmp = new Matrix4()
const limb = new Matrix4()
const pivot = new Matrix4()
const offset = new Matrix4()
const zero = new Matrix4().makeScale(0, 0, 0)
const q = new Quaternion()
const v = new Vector3()
const s = new Vector3()
const lying = new Matrix4().makeRotationX(-Math.PI / 2).premultiply(new Matrix4().makeTranslation(0, 0.18, 0))

export default function Pedestrians() {
  const boxes = useRef()
  const faces = useRef()
  const shadows = useRef()
  const faceMaterial = useMemo(createFaceMaterial, [])
  const faceGeometry = useMemo(() => {
    const g = new PlaneGeometry(FACE.size[0], FACE.size[1])
    g.setAttribute('aFace', new InstancedBufferAttribute(new Float32Array(npcs.map((n) => n.look.face)), 1))
    return g
  }, [])
  // Each NPC's boxes, with their local pivot/offset matrices prebuilt.
  const rigs = useMemo(
    () =>
      npcs.map((n) =>
        personParts(n.look).map((p) => ({
          swing: p.swing,
          color: p.color,
          pivot: new Matrix4().makeTranslation(...p.pivot),
          offset: new Matrix4().makeTranslation(...p.offset).multiply(new Matrix4().makeScale(...p.size)),
        })),
      ),
    [],
  )

  useLayoutEffect(() => {
    const c = new Color()
    rigs.forEach((rig, i) => rig.forEach((p, k) => boxes.current.setColorAt(i * SLOTS + k, c.set(p.color))))
    boxes.current.instanceColor.needsUpdate = true
  }, [rigs])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const game = useGame.getState()
    const driving = game.mode === 'car' && world.car
    let car = null
    if (driving) {
      const t = world.car.translation()
      car = { x: t.x, z: t.z, yaw: world.heading, speed: world.carSpeed ?? 0, half: VEHICLES[game.carType].half }
    }
    const hits = updatePedestrians(dt, world.focus, car, game.mode === 'foot')
    if (hits) world.events.push({ type: 'pedHit', count: hits })

    const fx = world.focus.x
    const fz = world.focus.z
    npcs.forEach((n, i) => {
      const dx = n.x - fx
      const dz = n.z - fz
      if (dx * dx + dz * dz > DRAW_DISTANCE * DRAW_DISTANCE) {
        if (n.shown !== false) {
          for (let k = 0; k < SLOTS; k++) boxes.current.setMatrixAt(i * SLOTS + k, zero)
          faces.current.setMatrixAt(i, zero)
          shadows.current.setMatrixAt(i, zero)
          n.shown = false
        }
        return
      }
      n.shown = true
      n.phase += rawDt * (n.moving ? (n.panic > 0 ? 9 : 6) : 1.5)
      const swing = n.down > 0 ? 0.2 : n.moving ? Math.sin(n.phase) * (n.panic > 0 ? 0.9 : 0.55) : 0
      const idleArm = n.moving || n.down > 0 ? swing : Math.sin(n.phase) * 0.06

      q.setFromAxisAngle(v.set(0, 1, 0), n.yaw)
      base.compose(v.set(n.x + n.ox, n.y, n.z + n.oz), q, s.setScalar(n.look.height))
      if (n.down > 0) base.multiply(lying)

      rigs[i].forEach((p, k) => {
        tmp.multiplyMatrices(base, p.pivot)
        if (p.swing) {
          const a = p.swing === 'legL' ? swing : p.swing === 'legR' ? -swing : p.swing === 'armL' ? -idleArm * 0.8 : idleArm * 0.8
          tmp.multiply(limb.makeRotationX(a))
        }
        tmp.multiply(p.offset)
        boxes.current.setMatrixAt(i * SLOTS + k, tmp)
      })
      faces.current.setMatrixAt(i, tmp.multiplyMatrices(base, pivot.makeTranslation(...FACE.pos)))
      shadows.current.setMatrixAt(i, tmp.makeScale(n.down > 0 ? 1.1 : 0.9, 1, n.down > 0 ? 2 : 0.9).setPosition(n.x + n.ox, n.y + 0.02, n.z + n.oz))
    })
    boxes.current.instanceMatrix.needsUpdate = true
    faces.current.instanceMatrix.needsUpdate = true
    shadows.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      <instancedMesh ref={boxes} args={[unitBox, undefined, npcs.length * SLOTS]} frustumCulled={false}>
        <meshToonMaterial gradientMap={toonRamp} />
      </instancedMesh>
      <instancedMesh ref={faces} args={[faceGeometry, faceMaterial, npcs.length]} frustumCulled={false} />
      <instancedMesh ref={shadows} args={[blobGeometry, blobMaterial, npcs.length]} frustumCulled={false} renderOrder={-1} />
    </group>
  )
}
