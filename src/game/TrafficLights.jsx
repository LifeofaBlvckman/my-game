import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BoxGeometry, Color } from 'three'
import { CylinderCollider, RigidBody } from '@react-three/rapier'
import { ROAD } from './cityData'
import { approaches, lightFor, signals } from './signals'
import { Instances, baseBox, unitBox } from './Instances'
import { unlit } from './materials'

const poleGeometry = new BoxGeometry(0.18, 4.8, 0.18).translate(0, 2.4, 0)
const lampMaterial = unlit()
const COLORS = { red: '#ff2a1a', yellow: '#ffc21a', green: '#2aff5a', off: '#1c1c1c' }
const ORDER = ['red', 'yellow', 'green']
const c = new Color()

export default function TrafficLights() {
  const lamps = useRef()
  const lastKey = useRef('')

  const lampItems = useMemo(
    () => approaches.flatMap((a, k) => ORDER.map((color, n) => ({ a, k, color, y: 4.75 - n * 0.42 }))),
    [],
  )

  const crossings = useMemo(() => {
    const stripes = []
    approaches.forEach((a) => {
      // Zebra crossing on each road arm, plus a stop line across the incoming lane.
      const d = ROAD / 2 + 1.6
      for (let s = -ROAD / 2 + 0.8; s < ROAD / 2 - 0.4; s += 1.1) {
        stripes.push({ x: a.nx - a.ux * d + (a.uz ? s : 0), z: a.nz - a.uz * d + (a.ux ? s : 0), along: a.axis, len: 2.6, wid: 0.55 })
      }
      const sd = ROAD / 2 + 3.4
      stripes.push({ x: a.nx - a.ux * sd - a.uz * 3, z: a.nz - a.uz * sd + a.ux * 3, along: a.axis === 'x' ? 'z' : 'x', len: 5.6, wid: 0.35 })
    })
    return stripes
  }, [])

  useFrame((_, dt) => {
    signals.t += dt
    const key = lightFor('x') + lightFor('z')
    if (key === lastKey.current || !lamps.current) return
    lastKey.current = key
    lampItems.forEach((l, i) => lamps.current.setColorAt(i, c.set(lightFor(l.a.axis) === l.color ? COLORS[l.color] : COLORS.off)))
    lamps.current.instanceColor.needsUpdate = true
  })

  return (
    <group>
      <Instances
        items={crossings}
        geometry={baseBox}
        transform={(o, s) => {
          o.position.set(s.x, 0.005, s.z)
          o.scale.set(s.along === 'x' ? s.len : s.wid, 0.02, s.along === 'x' ? s.wid : s.len)
        }}
        colors={() => '#eeeeea'}
      />
      <Instances items={approaches} geometry={poleGeometry} transform={(o, a) => o.position.set(a.x, 0, a.z)} colors={() => '#2b2f2a'} />
      <Instances
        items={approaches}
        geometry={unitBox}
        transform={(o, a) => {
          o.position.set(a.x, 4.33, a.z)
          o.scale.set(0.5, 1.4, 0.4)
        }}
        colors={() => '#1a1d1a'}
      />
      <Instances
        ref={lamps}
        items={lampItems}
        geometry={unitBox}
        material={lampMaterial}
        transform={(o, l) => {
          o.position.set(l.a.x - l.a.ux * 0.22, l.y, l.a.z - l.a.uz * 0.22)
          o.rotation.y = Math.atan2(l.a.ux, l.a.uz)
          o.scale.set(0.3, 0.3, 0.06)
        }}
        colors={() => COLORS.off}
      />
      <RigidBody type="fixed" colliders={false}>
        {approaches.map((a, i) => (
          <CylinderCollider key={i} args={[2.4, 0.15]} position={[a.x, 2.4, a.z]} />
        ))}
      </RigidBody>
    </group>
  )
}
