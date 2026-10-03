import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, DoubleSide, Matrix4, Quaternion, Vector3 } from 'three'
import { mulberry32 } from './cityData'
import { nightUniform, unlit } from './materials'
import { world } from './state'

// Little flocks of birds drifting across the sky, as small dark ink marks,
// the way Messenger does it. Each flock circles slowly somewhere over the
// player; each bird flaps for a bit, then glides. They roost at night.

const FLOCKS = 11
const PER_FLOCK = 8
const COUNT = FLOCKS * PER_FLOCK

// One wing: a thin swept triangle from the body out to the tip (+x).
const wing = new BufferGeometry()
wing.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0.18, 0, 0, -0.22, 0.75, 0.04, -0.28]), 3))
wing.computeVertexNormals()
const material = unlit({ color: '#2b2a36', side: DoubleSide, fog: true })

const m = new Matrix4()
const r = new Matrix4()
const flapM = new Matrix4()
const mirror = new Matrix4().makeScale(-1, 1, 1)
const q = new Quaternion()
const p = new Vector3()
const sc = new Vector3()
const up = new Vector3(0, 1, 0)
const zero = new Matrix4().makeScale(0, 0, 0)

export default function Birds() {
  const mesh = useRef()
  const birds = useMemo(() => {
    const rand = mulberry32(77)
    const flocks = Array.from({ length: FLOCKS }, (_, f) => ({
      angle: rand() * Math.PI * 2,
      // Some wheel close overhead, low over the roofs; others far and high.
      radius: (f % 3 === 0 ? 30 : 60) + rand() * 110,
      speed: (0.05 + rand() * 0.05) * (f % 2 ? 1 : -1),
      height: (f % 3 === 0 ? 28 : 38) + rand() * 34,
      drift: rand() * 100,
    }))
    const list = Array.from({ length: COUNT }, (_, i) => {
      const f = Math.floor(i / PER_FLOCK)
      const k = i % PER_FLOCK
      // A loose V: the leader in front, the rest trailing off both sides.
      const side = k === 0 ? 0 : k % 2 ? 1 : -1
      const rank = Math.ceil(k / 2)
      return {
        flock: flocks[f],
        back: rank * 2.4 + rand() * 0.8,
        across: side * rank * 1.8 + (rand() - 0.5) * 0.6,
        lift: (rand() - 0.5) * 1.5,
        phase: rand() * 10,
        size: 1.3 + rand() * 0.5,
      }
    })
    return { flocks, list }
  }, [])

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const t = clock.elapsedTime
    const asleep = nightUniform.value > 0.7
    const focus = world.focus
    for (const f of birds.flocks) f.angle += f.speed * dt
    birds.list.forEach((b, i) => {
      if (asleep) {
        mesh.current.setMatrixAt(i * 2, zero)
        mesh.current.setMatrixAt(i * 2 + 1, zero)
        return
      }
      const f = b.flock
      // Circle around a point that wanders a little, near the player.
      const cx = focus.x + Math.sin(t * 0.02 + f.drift) * 40
      const cz = focus.z + Math.cos(t * 0.017 + f.drift) * 40
      // Fly along the circle (its tangent), clockwise or anticlockwise.
      const turn = Math.sign(f.speed)
      const fx = -turn * Math.sin(f.angle)
      const fz = turn * Math.cos(f.angle)
      const heading = Math.atan2(fx, fz)
      p.set(
        cx + Math.cos(f.angle) * f.radius - fx * b.back + fz * b.across,
        f.height + b.lift + Math.sin(t * 0.6 + b.phase) * 0.8,
        cz + Math.sin(f.angle) * f.radius - fz * b.back - fx * b.across,
      )
      // Flap for a few seconds, then glide with the wings held up a little.
      const cycle = (t + b.phase) % 6
      const flap = cycle < 3.5 ? Math.sin((t + b.phase) * 11) * 0.7 : 0.18
      q.setFromAxisAngle(up, heading)
      m.compose(p, q, sc.set(b.size, b.size, b.size))
      flapM.makeRotationZ(flap)
      mesh.current.setMatrixAt(i * 2, r.multiplyMatrices(m, flapM)) // right wing
      mesh.current.setMatrixAt(i * 2 + 1, r.multiplyMatrices(m, mirror).multiply(flapM)) // left wing
    })
    mesh.current.instanceMatrix.needsUpdate = true
  })

  return <instancedMesh ref={mesh} args={[wing, material, COUNT * 2]} frustumCulled={false} userData={{ noShadow: true }} />
}
