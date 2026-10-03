import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { BoxGeometry, Color, Matrix4, Quaternion, Vector3 } from 'three'
import { dogs, initDogs, updateDogs } from './strays'
import { toon } from './materials'
import { useGame, world } from './state'

// Drawing the street dogs: one instanced mesh per body part, posed each frame.
// Part: [x, y, z, w, h, d, color] in dog space (facing +z, feet at y 0);
// color 'coat' / 'dark' follow the dog. `pivot` parts swing about their top.

const PARTS = [
  { id: 'body', at: [0, 0.42, -0.05], size: [0.3, 0.28, 0.7], color: 'coat' },
  { id: 'chest', at: [0, 0.46, 0.27], size: [0.33, 0.32, 0.28], color: 'coat' },
  { id: 'head', at: [0, 0.64, 0.5], size: [0.25, 0.23, 0.25], color: 'coat', head: true },
  { id: 'snout', at: [0, 0.59, 0.67], size: [0.14, 0.12, 0.17], color: 'light', head: true },
  { id: 'nose', at: [0, 0.62, 0.76], size: [0.06, 0.05, 0.03], color: '#141414', head: true },
  { id: 'earL', at: [0.09, 0.79, 0.47], size: [0.07, 0.12, 0.05], color: 'dark', head: true },
  { id: 'earR', at: [-0.09, 0.79, 0.47], size: [0.07, 0.12, 0.05], color: 'dark', head: true },
  { id: 'legFL', at: [0.1, 0.3, 0.27], size: [0.08, 0.3, 0.08], color: 'dark', leg: 1 },
  { id: 'legFR', at: [-0.1, 0.3, 0.27], size: [0.08, 0.3, 0.08], color: 'dark', leg: -1 },
  { id: 'legBL', at: [0.1, 0.3, -0.3], size: [0.08, 0.3, 0.08], color: 'dark', leg: -1 },
  { id: 'legBR', at: [-0.1, 0.3, -0.3], size: [0.08, 0.3, 0.08], color: 'dark', leg: 1 },
  { id: 'tail', at: [0, 0.52, -0.4], size: [0.05, 0.05, 0.3], color: 'coat', tail: true },
]

const box = new BoxGeometry(1, 1, 1)
// Legs hang from their top, the tail sticks out from its root.
const legBox = new BoxGeometry(1, 1, 1).translate(0, -0.5, 0)
const tailBox = new BoxGeometry(1, 1, 1).translate(0, 0, -0.5)
const material = toon()

const m = new Matrix4()
const part = new Matrix4()
const rot = new Matrix4()
const out = new Matrix4()
const q = new Quaternion()
const v = new Vector3()
const s = new Vector3()
const up = new Vector3(0, 1, 0)
const c = new Color()

const shade = (hex, k) => '#' + c.set(hex).multiplyScalar(k).getHexString()

export default function Dogs() {
  const meshes = useRef([])
  const camera = useThree((st) => st.camera)
  useMemo(() => dogs.length || initDogs(world.focus), [])
  useLayoutEffect(() => {
    PARTS.forEach((p, i) => {
      const mesh = meshes.current[i]
      dogs.forEach((dog, k) => {
        const color = p.color === 'coat' ? dog.coat : p.color === 'dark' ? shade(dog.coat, 0.7) : p.color === 'light' ? shade(dog.coat, 1.15) : p.color
        mesh.setColorAt(k, c.set(color))
      })
      mesh.instanceColor.needsUpdate = true
    })
  }, [])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const game = useGame.getState()
    const outside = !game.inside
    const car = game.mode === 'car' && world.car ? world.car.translation() : null
    if (outside) updateDogs(dt, world.focus, camera.position, car && { x: car.x, z: car.z, speed: Math.abs(world.carSpeed) })
    dogs.forEach((dog, k) => {
      const sitting = dog.state === 'sit' && dog.flee <= 0
      const sniff = dog.state === 'sniff' ? -0.35 + Math.sin(dog.phase * 3 + performance.now() / 300) * 0.05 : 0
      const bark = dog.barking > 0 ? 0.25 : 0
      m.compose(v.set(dog.x, 0.13, dog.z), q.setFromAxisAngle(up, dog.yaw), s.setScalar(outside ? dog.size : 0.0001))
      PARTS.forEach((p, i) => {
        let pitch = 0
        let y = p.at[1]
        let z = p.at[2]
        if (p.leg) pitch = Math.sin(dog.phase) * 0.6 * p.leg * Math.min(1, dog.speed)
        if (p.head) pitch = sniff - bark
        if (sitting) {
          // Haunches down, front legs straight: the whole back end drops.
          if (z < 0) y -= p.leg ? 0.05 : 0.17
          if (p.leg && z < 0) pitch = -1.2
        }
        part.makeTranslation(p.at[0], y, z)
        if (p.tail) {
          // Up at an angle, wagging side to side.
          part.multiply(rot.makeRotationY(Math.sin(dog.wag) * 0.6))
          part.multiply(rot.makeRotationX(-0.6))
        } else part.multiply(rot.makeRotationX(pitch))
        part.scale(s.set(...p.size))
        meshes.current[i].setMatrixAt(k, out.multiplyMatrices(m, part))
      })
    })
    meshes.current.forEach((mesh) => (mesh.instanceMatrix.needsUpdate = true))
  })

  return (
    <group>
      {PARTS.map((p, i) => (
        <instancedMesh
          key={p.id}
          ref={(el) => (meshes.current[i] = el)}
          args={[p.leg ? legBox : p.tail ? tailBox : box, material, dogs.length || 14]}
          frustumCulled={false}
          userData={{ noCast: true }}
        />
      ))}
    </group>
  )
}
